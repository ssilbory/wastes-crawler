// Choosing where to go, and a sensible default plan for each quarter so a player can pass time in
// one click: hike by day toward a destination; make camp in the evening and sleep in shifts with
// someone always on watch (docs/rules-adaptation.md, Overland travel).
import { hexKey, type Hex } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { alive, bestAt } from './members.ts';
import { findPath, regionMap, seenHexes } from './region.ts';
import type { Activity, Member, QuarterPlan, World } from './types.ts';

/** Sets a destination the party knows a route to; false if there's none. */
export function setDestination(w: World, data: GameData, to: Hex | null): boolean {
  if (to === null || hexKey(to) === hexKey(w.position)) {
    w.destination = null;
    return to !== null;
  }
  const map = regionMap(data, w.region);
  if (!findPath(map, w.position, to, seenHexes(map, w.visited))) return false;
  w.destination = to;
  return true;
}

/** The planned route, for drawing it on the map. */
export function route(w: World, data: GameData): Hex[] {
  if (!w.destination) return [];
  const map = regionMap(data, w.region);
  return findPath(map, w.position, w.destination, seenHexes(map, w.visited)) ?? [];
}

const able = (w: World) => alive(w).filter((m) => m.character.hp.current > 0);

function others(list: Member[], ...skip: (Member | undefined)[]): Member[] {
  return list.filter((m) => !skip.includes(m));
}

/** The suggested plan; `prefer` asks for a hike (given a destination) or a camp regardless. */
export function suggestPlan(w: World, data: GameData, prefer?: QuarterPlan['kind']): QuarterPlan {
  const party = able(w);
  const inTown = regionMap(data, w.region).siteAt(w.position) !== undefined;
  const leader = bestAt(data, party, 'survive', ['wis']);
  if (w.destination && prefer !== 'camp' && (w.quarter < 2 || prefer === 'hike')) {
    const watcher = bestAt(data, others(party, leader), 'notice', ['wis']) ?? leader;
    return { kind: 'hike', leader: leader?.id ?? null, watcher: watcher?.id ?? null };
  }
  const activities: Record<string, Activity> = {};
  const set = (m: Member | undefined, a: Activity) => m && (activities[m.id] = a);
  if (inTown) {
    for (const m of party) set(m, w.quarter >= 2 ? 'sleep' : 'rest');
    return { kind: 'camp', activities };
  }
  if (w.quarter < 2) {
    for (const m of party) set(m, 'rest');
    set(leader, 'forage');
    set(bestAt(data, others(party, leader), 'survive', ['wis']), 'hunt');
    return { kind: 'camp', activities };
  }
  // Evening: one makes camp, one keeps watch, the rest sleep. Night: whoever is still awake sleeps,
  // and someone already rested takes the watch.
  for (const m of party) set(m, m.slept ? 'rest' : 'sleep');
  if (w.quarter === 2) {
    if (w.camp !== 'made') set(leader, 'make-camp');
    set(bestAt(data, others(party, leader), 'notice', ['wis']) ?? leader, 'watch');
  } else {
    const rested = party.filter((m) => m.slept);
    set(bestAt(data, rested, 'notice', ['wis']), 'watch');
  }
  return { kind: 'camp', activities };
}
