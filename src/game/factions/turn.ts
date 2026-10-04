// The faction turn (vendor/wwn-srd/6.0 Factions/The Faction Turn.md), run as each month begins
// (Sam's call). Each faction rolls 1d8 for initiative, ties going in content order, then earns
// Treasure, triggers its assets' abilities, takes one action, and checks its goal. Ratings never
// fall, so no faction holds more assets than its ratings allow and no upkeep is due. The actions
// are chosen for the GM (docs/rules-adaptation.md, Factions): repair when badly hurt; a faction
// keeping the peace builds where it is weakest; one with a fighting goal attacks where it can,
// builds while short of fighters or flush with Treasure, and otherwise marches on its target. The warlord's clock moves with
// the clock faction's goals (Phase 12d's monthly tick, replaced).
import type { FactionState } from '../../data/schemas/index.ts';
import { rollDie } from '../../rules/dice.ts';
import { factionIncome, factionMaxHp } from '../../rules/factions.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from '../world/bus.ts';
import { moveClock } from '../world/clock.ts';
import type { World } from '../world/types.ts';
import {
  attackAction,
  createAction,
  isHurt,
  moveAction,
  readyAttackers,
  repairAction,
  type OnStrike,
} from './actions.ts';
import { checkGoal, pickGoal, weakestBase } from './goals.ts';
import {
  assetRule,
  factionOf,
  hasDamage,
  isActive,
  locationName,
  ratings,
  srdAsset,
  startFactions,
} from './state.ts';

/** A fighting faction builds while it has fewer fighters than this, or this much Treasure. */
const MIN_FIGHTERS = 2;
const FLUSH = 10;

/** Farmers, Manufactory, and the like: Treasure from a d6 each turn. */
function assetIncome(w: World, data: GameData, s: FactionState): void {
  for (const a of s.assets) {
    const special = assetRule(data, a.asset).special;
    if (special?.kind !== 'income') continue;
    s.treasure = Math.max(0, s.treasure + (special.faces[rollDie(w.rng, 6) - 1] as number));
  }
}

/** Badly hurt: the faction at half its hit points or less, or an asset at half or less. */
function badlyHurt(data: GameData, s: FactionState): boolean {
  return (
    s.hp * 2 <= factionMaxHp(ratings(s)) ||
    s.assets.some((a) => a.hp * 2 <= srdAsset(data, a.asset).hp)
  );
}

/** The faction's one action; returns whether it attacked. */
export function takeAction(w: World, data: GameData, id: string, onStrike: OnStrike): boolean {
  const s = w.factions[id] as FactionState;
  const goal = s.goal as NonNullable<FactionState['goal']>;
  if (s.idle) {
    s.idle = false;
    return false;
  }
  if (badlyHurt(data, s) && s.treasure > 0) {
    repairAction(data, s);
    return false;
  }
  if (goal.kind === 'peaceable-kingdom') {
    if (!createAction(w, data, id, false) && isHurt(data, s)) repairAction(data, s);
    return false;
  }
  if (readyAttackers(w, data, id).length > 0) {
    attackAction(w, data, id, onStrike);
    return true;
  }
  // Build up first while short of fighters or flush with Treasure, then march.
  const fighters = s.assets.filter((a) => hasDamage(data, a.asset)).length;
  if ((fighters < MIN_FIGHTERS || s.treasure >= FLUSH) && createAction(w, data, id, true))
    return false;
  const to = goal.target?.at ?? weakestBase(w, data, id)?.at;
  if (to && fighters > 0) moveAction(w, data, id, to);
  return false;
}

/** One faction turn for every faction still standing. */
export function factionTurn(w: World, data: GameData): void {
  startFactions(w, data);
  const clockFaction = data.content.campaign.clock.faction;
  const order = data.content.factions.factions
    .map((f, i) => ({ id: f.id, i, roll: rollDie(w.rng, 8) }))
    .sort((a, b) => b.roll - a.roll || a.i - b.i)
    .map((x) => x.id);
  for (const id of order) {
    const s = w.factions[id];
    if (!isActive(s)) continue;
    if (!s.goal) pickGoal(w, data, id, 0);
    s.treasure += factionIncome(ratings(s));
    assetIncome(w, data, s);
    const onStrike: OnStrike = (victim, at, r) => {
      const goal = s.goal as NonNullable<FactionState['goal']>;
      if (goal.kind === 'blood-the-enemy') goal.progress += r.dealt;
      if (r.razed && goal.target?.faction === victim && goal.target.at === at) goal.progress = 1;
      if (r.razed && id === clockFaction)
        moveClock(w, data, 1, `${factionOf(data, id).name} takes ${locationName(data, at)}.`);
    };
    const attacked = takeAction(w, data, id, onStrike);
    if (checkGoal(w, data, id, attacked) && id === clockFaction)
      moveClock(w, data, 1, `${factionOf(data, id).name} grows stronger.`);
  }
}

/** The factions' bus listener: a turn as each month begins. */
export function factionsListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'day-passed' && (w.day + 1) % data.content.overlandRules.daysPerMonth === 0)
    factionTurn(w, data);
}
