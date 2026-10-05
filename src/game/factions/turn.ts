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
import { note } from '../world/members.ts';
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
import { patrolBeaten } from './patrols.ts';
import { warnRaid } from './raid.ts';
import { hurtAsset } from './combat.ts';
import { strikesFor } from './strikes.ts';
import {
  assetName,
  assetRule,
  factionOf,
  hasDamage,
  isActive,
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
    attackAction(w, data, id, onStrike, warnRaid(w, data, id));
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
    const onStrike = strikesFor(w, data, id);
    const attacked = takeAction(w, data, id, onStrike);
    if (checkGoal(w, data, id, attacked) && id === clockFaction)
      moveClock(w, data, 1, `${factionOf(data, id).name} grows stronger.`);
  }
}

/**
 * The quests and rescues that knock the warlord's clock back also hurt the clock faction's
 * sturdiest asset (Phase 13b).
 */
function knockBack(w: World, data: GameData): void {
  const { faction, knockback } = data.content.campaign.clock;
  const s = w.factions[faction];
  if (!isActive(s) || s.assets.length === 0) return;
  const sturdiest = s.assets.reduce((a, b) => (b.hp > a.hp ? b : a));
  note(
    w,
    `${factionOf(data, faction).name}'s ${assetName(data, faction, sturdiest.asset)} feels the blow.`,
  );
  hurtAsset(w, data, faction, sturdiest, knockback.damage);
}

/**
 * The factions' bus listener: a turn as each month begins, a beaten patrol's asset hurt, and the
 * clock faction hurt by a knock back.
 */
export function factionsListener(w: World, data: GameData, e: WorldEvent): void {
  const { knockback } = data.content.campaign.clock;
  if (e.kind === 'day-passed' && (w.day + 1) % data.content.overlandRules.daysPerMonth === 0)
    factionTurn(w, data);
  else if (e.kind === 'fight-won' && e.patrol) patrolBeaten(w, data, e.patrol);
  else if (
    (e.kind === 'quest-done' && knockback.quests.includes(e.quest)) ||
    (e.kind === 'captive-freed' && knockback.captives.includes(e.captive))
  )
    knockBack(w, data);
}
