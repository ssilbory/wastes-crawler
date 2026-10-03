// One run of the economy validator (docs/rules-adaptation.md, Economy validator in Phase 9): an
// abstract party delves, comes back to a town, cashes in its loot, raises its dead, rests at the
// inn, and levels up, over and over. Fights are drawn from the delve's real encounter table for
// their loot dice; wounds, deaths, and XP come from rates measured with the combat sim. Town costs
// go through the real thresholds, surcharges, payouts, resets, and climate (src/rules/economy.ts).
import type { EconomySim, Site } from '../../data/schemas/index.ts';
import { levelForXp, xpForLevel } from '../../rules/advancement.ts';
import { roll } from '../../rules/dice.ts';
import { lootPayout, rollClimate, surchargedCost, toTenths } from '../../rules/economy.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';

/**
 * The lock-outs a run can hit. Two of Sam's four can't happen in this model by construction, and
 * aren't simulated: a party can always recover, since a made camp heals for free, and can always
 * field a full party, since the tavern always has a recruit.
 */
export type Lockout = 'loot-worthless' | 'no-progress';

interface Pc {
  /** Maximum hit points at 1st level. */
  baseHp: number;
  maxHp: number;
  hp: number;
  level: number;
  xp: number;
  dead: boolean;
}

interface Ledger {
  spent: number;
  looted: number;
  since: number;
}

export interface RunResult {
  /** The first delve each lock-out happened on. */
  locks: Partial<Record<Lockout, number>>;
  purse: number;
  levels: number[];
  day: number;
  /** Nights spent recovering at the inn, and free in camp. */
  innNights: number;
  campNights: number;
  /** The dead raised by a raising quest, raised for crowns, and replaced from the tavern. */
  raised: { quest: number; paid: number; recruited: number };
}

/** Loot dice from one fight drawn from the table: each monster's own dice, rolled now. */
function fightLoot(rng: Rng, data: GameData, tableId: string): number {
  const table = data.content.encounterTables.find((t) => t.id === tableId);
  if (!table) throw new Error(`unknown encounter table ${tableId}`);
  let pick = rng.int(
    1,
    table.entries.reduce((sum, e) => sum + e.weight, 0),
  );
  const entry = table.entries.find((e) => (pick -= e.weight) <= 0) as (typeof table.entries)[0];
  let crowns = 0;
  for (const g of entry.groups) {
    const n = typeof g.count === 'number' ? g.count : Math.max(1, roll(rng, g.count).total);
    const loot = data.content.monsterCombat.find((m) => m.id === g.monster)?.loot;
    for (let i = 0; loot && i < n; i++)
      crowns += roll(rng, { count: loot.count, sides: loot.sides, modifier: 0 }).total;
  }
  return crowns;
}

function townOf(data: GameData, id: string): Site {
  const site = data.content.regions.flatMap((r) => r.sites).find((s) => s.id === id);
  if (!site) throw new Error(`unknown town ${id}`);
  return site;
}

export function runEconomy(
  rng: Rng,
  data: GameData,
  sim: EconomySim,
  towns: readonly string[],
): RunResult {
  const rules = data.content.townRules;
  const month = data.content.overlandRules.daysPerMonth;
  const lock = sim.lockouts;
  const pcs: Pc[] = sim.party.maxHp.map((maxHp) => ({
    baseHp: maxHp,
    maxHp,
    hp: maxHp,
    level: 1,
    xp: 0,
    dead: false,
  }));
  /** PCs who died and were never raised, still in the world. */
  const fallen: Pc[] = [];
  const locks: RunResult['locks'] = {};
  const flag = (kind: Lockout, delve: number) => {
    locks[kind] ??= delve;
  };
  const ledgers = new Map<string, Ledger>();
  let purse = sim.party.purse;
  let day = 0;
  let climateDay = 0;
  let worthlessSince: number | null = null;
  let stuck = 0;
  let innNights = 0;
  let questDay: number | null = null;
  const raised = { quest: 0, paid: 0, recruited: 0 };
  let campNights = 0;
  let here = towns[0] as string;
  // The first town is home: visited, with no climate roll, as in a new world.
  ledgers.set(here, { spent: 0, looted: 0, since: 0 });

  for (let delve = 1; delve <= sim.delves; delve++) {
    // Down into the dungeon.
    day += sim.delve.days;
    let loot = 0;
    const best = Math.max(...pcs.filter((p) => !p.dead).map((p) => p.level), 1);
    const deathChance =
      sim.fight.deathChance * sim.fight.deathFalloff ** Math.max(0, best - sim.delve.level);
    for (let f = 0; f < sim.delve.fights; f++) {
      const living = pcs.filter((p) => !p.dead);
      if (living.length === 0) break;
      loot += fightLoot(rng, data, sim.delve.table);
      for (const p of living) {
        if (rng.next() < deathChance) {
          p.dead = true;
          p.hp = 0;
          continue;
        }
        p.hp = Math.max(1, p.hp - Math.round(sim.fight.hpLost * p.maxHp * 2 * rng.next()));
        p.xp += sim.fight.xp;
      }
    }

    // Back to a town: the policy's next one, with the road between.
    const next = towns[delve % towns.length] as string;
    if (next !== here) day += sim.travelDays;
    here = next;
    const site = townOf(data, here);
    const threshold = rules.spendingThresholds[site.size];
    const open = ledgers.get(here);
    if (!open || day - climateDay > month) {
      const percent = rollClimate(rng, rules.climate.minPercent, rules.climate.maxPercent);
      purse = toTenths(Math.max(0, purse * (1 + percent / 100)));
      climateDay = day;
    }
    const ledger: Ledger =
      open && day - open.since < month ? open : { spent: 0, looted: 0, since: day };
    ledgers.set(here, ledger);
    const pay = (listed: number) => {
      const cost = surchargedCost(ledger.spent, listed, threshold, rules.surchargeRate);
      if (cost > purse) return false;
      purse = toTenths(purse - cost);
      ledger.spent += listed;
      return true;
    };

    // Cash in the loot.
    const lootThreshold = threshold * rules.lootThresholdFraction;
    purse = toTenths(purse + lootPayout(ledger.looted, loot, lootThreshold, rules.lootDropRate));
    ledger.looted += loot;
    if (lootPayout(ledger.looted, 1, lootThreshold, rules.lootDropRate) > 0) worthlessSince = null;
    else if (worthlessSince === null) worthlessSince = day;
    else if (day - worthlessSince > lock.worthlessDays) flag('loot-worthless', delve);

    // Raise the dead: one by a raising quest if none was taken this month (Raising quests), then
    // those the purse can pay for. Anyone else is replaced by a roster PC from the tavern, who
    // joins with the lowest XP of any PC in the world (docs/rules-adaptation.md, Towns in Phase
    // 6a). Then rest until everyone is whole: at the inn while the purse allows, then in a made
    // camp outside town, which heals as much for free (Food and Conditions).
    pcs.forEach((p, i) => {
      if (!p.dead) return;
      if (questDay === null || day - questDay >= month) {
        questDay = day;
        day += sim.raiseQuest.days;
        raised.quest += 1;
        Object.assign(p, { dead: false, hp: 1 });
        return;
      }
      if (pay(rules.temple.raisePerLevel * p.level)) {
        raised.paid += 1;
        Object.assign(p, { dead: false, hp: 1 });
        return;
      }
      raised.recruited += 1;
      fallen.push(p);
      const xp = Math.min(...[...pcs, ...fallen].map((x) => x.xp));
      const level = levelForXp(xp);
      const maxHp = p.baseHp + sim.party.hpPerLevel * (level - 1);
      pcs[i] = { baseHp: p.baseHp, maxHp, hp: maxHp, level, xp, dead: false };
    });
    const living = pcs.filter((p) => !p.dead);
    while (living.some((p) => p.hp < p.maxHp)) {
      if (pay(rules.innPerPc * living.length)) innNights += 1;
      else campNights += 1;
      day += 1;
      for (const p of living) p.hp = Math.min(p.maxHp, p.hp + p.level);
    }

    // Train up.
    let gained = false;
    for (const p of living)
      while (p.xp >= xpForLevel(p.level + 1)) {
        p.level += 1;
        p.maxHp += sim.party.hpPerLevel;
        p.hp += sim.party.hpPerLevel;
        gained = true;
      }
    stuck = gained || pcs.some((p) => p.level >= lock.belowLevel) ? 0 : stuck + 1;
    if (stuck > lock.stuckDelves) flag('no-progress', delve);
  }
  return {
    locks,
    purse,
    levels: pcs.map((p) => p.level),
    day,
    innNights,
    campNights,
    raised,
  };
}
