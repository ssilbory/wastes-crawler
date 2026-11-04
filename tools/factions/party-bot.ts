// The siege party bot (pnpm factions --party; Sam's calls, Phase 23f): the four starters, raised
// to a fixed level, played through two years of the Dark Lands' faction turns by a responder. It
// waits free at Cinderhold's inn (Phase 23c); a siege on the Free Settlements sends it there to
// fight every share; with none, it goes to a held settlement to fight in the Free Settlements'
// siege of it or storm it alone, taking the freeing quest on the way (Phase 23e). It keeps out of
// rivals' sieges. It travels by the game's own travel, fighting whatever it meets, rests at an
// inn when hurt, and raises its dead where it can. A party wiped out is gone for the run.
import type { GameData } from '../../src/game/character/context.ts';
import { autoLevel } from '../../src/game/character/auto-level.ts';
import { runBattle } from '../../src/game/combat/battle.ts';
import { emit } from '../../src/game/world/bus.ts';
import { enterRegion } from '../../src/game/world/enter-region.ts';
import { encounterBattle } from '../../src/game/world/fight.ts';
import { freeQuestsFrom } from '../../src/game/world/free-quests.ts';
import { newWorld } from '../../src/game/world/new-world.ts';
import { setDestination, suggestPlan } from '../../src/game/world/plans.ts';
import { passQuarter, settleByFighting, settleByLeaving } from '../../src/game/world/quarter.ts';
import { acceptQuest, giversHere, turnInQuest } from '../../src/game/world/quest-board.ts';
import { raiseDead, raiserHere, stayAtInn } from '../../src/game/world/services.ts';
import { allyHosts, waitForSiege } from '../../src/game/world/siege-wait.ts';
import { allyTowns, besieged, holderOf, settlementOf } from '../../src/game/world/siege-state.ts';
import { storm, stormTarget } from '../../src/game/world/storm.ts';
import { currentTown } from '../../src/game/world/town-prices.ts';
import type { World } from '../../src/game/world/types.ts';
import { distance, type Hex } from '../../src/rules/hex.ts';
import { createRng } from '../../src/rules/rng.ts';
import { party } from '../playtest/bot.ts';

export interface PartyRun {
  world: World;
  /** The month the party was wiped out, or null. */
  wipedIn: number | null;
  fights: number;
  siegeFights: number;
  won: number;
  freed: number;
  quests: number;
}

const HOME = 'cinderhold';
const living = (w: World) => w.members.filter((m) => !m.dead);
const hpShare = (w: World) => {
  const pcs = living(w);
  const cur = pcs.reduce((s, m) => s + Math.max(0, m.character.hp.current), 0);
  const max = pcs.reduce((s, m) => s + m.character.hp.max, 0);
  return max === 0 ? 0 : cur / max;
};
const hexOf = (data: GameData, town: string): Hex => {
  const site = settlementOf(data, town)?.site as Hex;
  return { col: site.col, row: site.row };
};

/** A world at Cinderhold with the starters at the level given, or with no party at all. */
export function siegeWorld(data: GameData, seed: string, level: number): World {
  const rng = createRng(seed);
  const w = newWorld(data, rng, party(data));
  enterRegion(w, 'dark-lands', hexOf(data, HOME));
  w.position = hexOf(data, HOME);
  w.purse = 1_000_000;
  if (level === 0) w.members = [];
  for (const m of w.members) m.character = autoLevel(data, m.character, level, rng);
  // Whole after levelling.
  for (const m of w.members)
    m.character = { ...m.character, hp: { ...m.character.hp, current: m.character.hp.max } };
  return w;
}

/** Where the party is needed: a siege on the ally, the ally's own siege, a held town, or home. */
function target(w: World, data: GameData): string {
  const ally = data.content.siegeRules.ally;
  const near = (towns: string[]) =>
    [...towns].sort(
      (a, b) => distance(hexOf(data, a), w.position) - distance(hexOf(data, b), w.position),
    )[0];
  const tiers = [
    w.sieges.filter((s) => s.defender === ally).map((s) => s.town),
    w.sieges.filter((s) => s.attacker === ally).map((s) => s.town),
    allyTowns(data).filter((t) => holderOf(w, data, t) !== null),
  ];
  for (const towns of tiers) if (towns.length > 0) return near(towns) as string;
  return HOME;
}

/** Errands in any town: raise the dead, and take and turn in freeing quests. */
function errands(w: World, data: GameData, r: PartyRun): void {
  if (raiserHere(w, data))
    for (const m of w.members.filter((x) => x.dead)) raiseDead(w, data, m.id);
  for (const g of giversHere(w, data)) {
    for (const q of freeQuestsFrom(w, data, g.id)) {
      const st = w.quests[q.id]?.status;
      if (st === 'ready' && turnInQuest(w, data, q.id).ok) r.quests += 1;
      else if (st === undefined || st === 'done' || st === 'failed') acceptQuest(w, data, q.id);
    }
  }
}

/** Fights a hostile meeting, or leaves a peaceful one. */
function meet(w: World, data: GameData, r: PartyRun): void {
  const e = w.encounter as NonNullable<World['encounter']>;
  if (!e.hostile) {
    if (!settleByLeaving(w, data)) w.encounter = null;
    return;
  }
  r.fights += 1;
  if (e.siege) r.siegeFights += 1;
  const fight = encounterBattle(w, data);
  const result = runBattle(fight.battle);
  if (result.outcome === 'party') r.won += 1;
  // Fixed level: no XP is reckoned.
  settleByFighting(w, data, fight, result, null);
}

/** One step of the bot's day: a fight, an errand and a night, or a quarter on the road. */
function step(w: World, data: GameData, r: PartyRun): void {
  if (w.encounter) {
    meet(w, data, r);
    return;
  }
  const goal = target(w, data);
  const here = w.dungeon ? undefined : currentTown(w, data)?.id;
  if (here) errands(w, data, r);
  const worn = hpShare(w) < 0.7 || w.members.some((m) => !m.dead && m.character.strain.value > 0);
  if (here === goal) {
    if (holderOf(w, data, here) && !worn && stormTarget(w, data)) storm(w, data);
    else if (!worn && allyHosts(w, data) && !besieged(w, here)) waitForSiege(w, data);
    else stayAtInn(w, data);
    return;
  }
  if (here && worn) {
    stayAtInn(w, data);
    return;
  }
  setDestination(w, data, hexOf(data, goal));
  passQuarter(w, data, suggestPlan(w, data));
}

/** A run's tally, before any day is played. */
export const newRun = (w: World): PartyRun => ({
  world: w,
  wipedIn: null,
  fights: 0,
  siegeFights: 0,
  won: 0,
  freed: 0,
  quests: 0,
});

/** Plays the run on to the day given, the party gone once wiped out. */
export function playUntil(
  w: World,
  data: GameData,
  r: PartyRun,
  days: number,
  month: number,
): void {
  let stuck = 0;
  while (w.day < days) {
    const day = w.day;
    if (living(w).length > 0 && stuck < 40) step(w, data, r);
    else {
      if (w.members.length > 0 && living(w).length === 0 && r.wipedIn === null) r.wipedIn = month;
      // No party, or one going nowhere: the day passes without it.
      w.encounter = null;
      emit(w, data, { kind: 'day-passed' });
      w.day += 1;
    }
    stuck = w.day === day ? stuck + 1 : 0;
  }
  r.freed = w.log.filter((l) => l.includes('thanks the party for its freedom')).length;
}
