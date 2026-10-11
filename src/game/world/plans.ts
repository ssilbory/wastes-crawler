// Choosing where to go, and a sensible default plan for each quarter so a player can pass time in
// one click: hike by day toward a destination; make camp in the evening and sleep in shifts with
// someone always on watch (docs/rules-adaptation.md, Overland travel). A crafter with work and
// tools crafts the day's camp shifts instead of foraging, and is spared the watch (Sam's call).
import { hexKey, type Hex } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { campProject } from './crafting.ts';
import { alive, bestAt, checkBonus } from './members.ts';
import { firstGuide } from './npcs.ts';
import { hexesToAvoid } from './groves.ts';
import { pathToward, regionMap, seenHexes } from './region.ts';
import type { Activity, Member, QuarterPlan, World } from './types.ts';

/** Sets a destination the party can head toward, even under fog; false if it can get no closer. */
export function setDestination(w: World, data: GameData, to: Hex | null): boolean {
  if (to === null || hexKey(to) === hexKey(w.position)) {
    w.destination = null;
    return to !== null;
  }
  const map = regionMap(data, w.region);
  if (!pathToward(map, w.position, to, seenHexes(map, w.visited), hexesToAvoid(w, data, to)))
    return false;
  w.destination = to;
  return true;
}

/** The planned route, for drawing it on the map. */
export function route(w: World, data: GameData): Hex[] {
  if (!w.destination) return [];
  const map = regionMap(data, w.region);
  const avoid = hexesToAvoid(w, data);
  return pathToward(map, w.position, w.destination, seenHexes(map, w.visited), avoid) ?? [];
}

const survivor = (m: Member) => Object.hasOwn(m.character.skills, 'survive');

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
    // A Wilderness Guide leads when no PC would do better than the guide's +1.
    const guide = firstGuide(w, data);
    const pc = leader && checkBonus(data, leader, 'survive', ['wis']);
    const lead =
      guide && (pc === undefined || pc < data.content.npcRules.skillBonus)
        ? guide.id
        : (leader?.id ?? null);
    return { kind: 'hike', leader: lead, watcher: watcher?.id ?? null };
  }
  const activities: Record<string, Activity> = {};
  const set = (m: Member | undefined, a: Activity) => m && (activities[m.id] = a);
  if (inTown) {
    for (const m of party) set(m, w.quarter >= 2 ? 'sleep' : 'rest');
    return { kind: 'camp', activities };
  }
  const crafters = party.filter((m) => campProject(w, data, m));
  const free = others(party, ...crafters);
  if (w.quarter < 2) {
    for (const m of party) set(m, 'rest');
    const forager = bestAt(data, free, 'survive', ['wis']);
    set(forager, 'forage');
    set(bestAt(data, others(free, forager), 'survive', ['wis']), 'hunt');
    for (const m of crafters) set(m, 'craft');
    return { kind: 'camp', activities };
  }
  // Evening: one makes camp, one keeps watch, the rest sleep. Night: whoever is still awake sleeps,
  // and someone already rested takes the watch. A crafter watches only if no one else can. Those
  // with Survival who have slept go for food rather than rest (Sam's call).
  const watch = (list: Member[]) =>
    bestAt(data, others(list, ...crafters), 'notice', ['wis']) ??
    bestAt(data, list, 'notice', ['wis']);
  for (const m of party) set(m, m.slept ? 'rest' : 'sleep');
  if (w.quarter === 2) {
    if (w.camp !== 'made') set(leader, 'make-camp');
    set(watch(others(party, leader)) ?? leader, 'watch');
  } else {
    // Food comes first for those with Survival, so the watch goes to someone without it if it can.
    const rested = party.filter((m) => m.slept);
    const plain = rested.filter((m) => !survivor(m));
    set(watch(plain.length > 0 ? plain : rested), 'watch');
  }
  const hunters = free.filter((m) => m.slept && activities[m.id] === 'rest' && survivor(m));
  const forager = bestAt(data, hunters, 'survive', ['wis']);
  set(forager, 'forage');
  set(bestAt(data, others(hunters, forager), 'survive', ['wis']), 'hunt');
  return { kind: 'camp', activities };
}
