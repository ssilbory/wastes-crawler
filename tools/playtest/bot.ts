// The playtest bot (tools/playtest.ts): the starter party played like a cautious player. From town
// it walks to a wild hex a few hexes off, explores there and nearby, and heads home when hurt,
// short of food, or done; in town it sells its loot, levels up, and rests at the inn. Every
// fight is fought; every other meeting is left.
import { readFileSync } from 'node:fs';
import { canLevelUp } from '../../src/game/character/advance.ts';
import { autoLevel } from '../../src/game/character/auto-level.ts';
import type { GameData } from '../../src/game/character/context.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { importCharacter } from '../../src/game/character/io.ts';
import { runBattle } from '../../src/game/combat/battle.ts';
import { difficultySeed, simulateDifficulty } from '../../src/game/world/difficulty.ts';
import { encounterBattle } from '../../src/game/world/fight.ts';
import { newWorld } from '../../src/game/world/new-world.ts';
import { setDestination, suggestPlan } from '../../src/game/world/plans.ts';
import { passQuarter, settleByFighting, settleByLeaving } from '../../src/game/world/quarter.ts';
import { regionMap } from '../../src/game/world/region.ts';
import { stayAtInn } from '../../src/game/world/services.ts';
import { exchangeLoot } from '../../src/game/world/shop.ts';
import type { World } from '../../src/game/world/types.ts';
import { distance, type Hex } from '../../src/rules/hex.ts';
import { createRng, type Rng } from '../../src/rules/rng.ts';

export interface Run {
  seed: number;
  /** The day the run ended: the last day, or the day of the wipe. */
  days: number;
  wipedBy: string | null;
  fights: number;
  /** Fights won with under a quarter of the party's hit points left. */
  closeCalls: number;
  deaths: number;
  level: number;
  sitesFound: number;
  startPurse: number;
  endPurse: number;
  lowestPurse: number;
  innNights: number;
  hungryNights: number;
  thirstyNights: number;
}

const STARTERS = ['snag', 'grukk', 'lirael', 'fizzwick'];

function party(data: GameData) {
  return STARTERS.map((file, i) => {
    const r = importCharacter(readFileSync(`tools/sim/parties/starter/${file}.json`, 'utf8'), data);
    if (!r.ok) throw new Error(`${file}: ${r.errors.join('; ')}`);
    return {
      character: r.character,
      row: i < 2 ? 0 : 1,
      column: i % 2,
      defaultAction: 'auto' as const,
    };
  });
}

const living = (w: World) => w.members.filter((m) => !m.dead);
const hpShare = (w: World) => {
  const cur = living(w).reduce((s, m) => s + Math.max(0, m.character.hp.current), 0);
  const max = living(w).reduce((s, m) => s + m.character.hp.max, 0);
  return max === 0 ? 0 : cur / max;
};
const levelOf = (data: GameData, w: World) =>
  Math.max(0, ...living(w).map((m) => characterSheet(m.character, data).level));

/** Hexes the party can walk to, within the distances given. */
function hexesAround(data: GameData, w: World, near: number, far: number): Hex[] {
  const map = regionMap(data, w.region);
  const out: Hex[] = [];
  for (let row = 0; row < map.height; row++)
    for (let col = 0; col < map.width; col++) {
      const h = { col, row };
      const d = distance(h, w.position);
      if (d >= near && d <= far && map.costOf(h) !== null && !map.siteAt(h)) out.push(h);
    }
  return out;
}
const pick = <T>(rng: Rng, list: T[]) => list[rng.int(0, list.length - 1)];

/** Fights or leaves the meeting; returns the names of the foes if the party was wiped. */
function settle(data: GameData, w: World, r: Run): string | null {
  const e = w.encounter as NonNullable<World['encounter']>;
  if (!e.hostile) {
    if (!settleByLeaving(w, data)) w.encounter = null;
    return null;
  }
  r.fights++;
  const names = [...new Set(e.enemies.flat())].join(' + ');
  const fight = encounterBattle(w, data);
  const difficulty = simulateDifficulty(
    data,
    fight.setup,
    difficultySeed(w),
    data.content.townRules.xp.simFights,
  );
  const result = runBattle(fight.battle);
  settleByFighting(w, data, fight, result, difficulty);
  if (result.outcome === 'enemy') return names;
  // The party's side as the battle left it, before any rest or healing after.
  const pcs = result.battle.combatants.filter((c) => c.kind === 'pc');
  r.deaths += pcs.filter((c) => c.status === 'dead').length;
  const hp = pcs.reduce((n, c) => n + Math.max(0, c.hp), 0);
  const max = pcs.reduce((n, c) => n + c.maxHp, 0);
  if (result.outcome === 'party' && hp < max / 4) r.closeCalls++;
  return null;
}

/** In town: sell, level, and rest until whole. Returns true if a night was spent at the inn. */
function townDay(data: GameData, w: World): boolean {
  if (w.loot.length > 0) exchangeLoot(w, data);
  for (const m of living(w))
    if (canLevelUp(data, m.character)) {
      const level = characterSheet(m.character, data).level;
      m.character = autoLevel(data, m.character, level + 1, w.rng);
    }
  const worn = hpShare(w) < 0.95 || w.members.some((m) => !m.dead && m.character.strain.value > 0);
  return (worn || w.rations < 12) && stayAtInn(w, data).ok;
}

/** One run of so many days, the world and the bot each seeded from the seed. */
export function play(data: GameData, seed: string, n: number, days: number): Run {
  const w = newWorld(data, createRng(`${seed}-world-${n}`), party(data));
  const rng = createRng(`${seed}-bot-${n}`);
  const home = { ...w.position };
  const r: Run = {
    seed: n,
    days: 0,
    wipedBy: null,
    fights: 0,
    closeCalls: 0,
    deaths: 0,
    level: 1,
    sitesFound: 0,
    startPurse: w.purse,
    endPurse: w.purse,
    lowestPurse: w.purse,
    innNights: 0,
    hungryNights: 0,
    thirstyNights: 0,
  };
  let explored = 0;
  let homeward = false;
  for (let steps = 0; w.day < days && steps < days * 12 && living(w).length > 0; steps++) {
    if (w.encounter) {
      r.wipedBy = settle(data, w, r);
      if (r.wipedBy) break;
      continue;
    }
    r.lowestPurse = Math.min(r.lowestPurse, w.purse);
    const inTown = regionMap(data, w.region).siteAt(w.position) !== undefined;
    if (inTown) {
      if (townDay(data, w)) {
        r.innNights++;
        continue;
      }
      const target = pick(rng, hexesAround(data, w, 3, 8));
      if (target) setDestination(w, data, target);
      homeward = false;
      explored = 0;
    } else if (!homeward && (hpShare(w) < 0.5 || w.rations <= 4 || explored >= 3)) {
      homeward = true;
      setDestination(w, data, home);
    }
    let plan = suggestPlan(w, data);
    if (!homeward && !inTown && w.destination === null && w.quarter < 2) {
      // At the target, by day: the best scout explores, then the party moves a hex on.
      const camp = suggestPlan(w, data, 'camp');
      const scout = living(w).find((m) => m.character.name === 'Lirael') ?? living(w)[0];
      if (camp.kind === 'camp' && scout) {
        camp.activities[scout.id] = 'explore';
        plan = camp;
        if (++explored === 2) {
          const next = pick(rng, hexesAround(data, w, 1, 1));
          if (next) setDestination(w, data, next);
        }
      }
    }
    const day = w.day;
    passQuarter(w, data, plan);
    if (w.day !== day) {
      if (w.members.some((m) => m.hungry)) r.hungryNights++;
      if (w.members.some((m) => m.thirsty)) r.thirstyNights++;
    }
  }
  r.days = w.day;
  r.level = levelOf(data, w);
  r.sitesFound = w.sites.found.length;
  r.endPurse = w.purse;
  return r;
}
