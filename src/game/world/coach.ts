// Coach routes (docs/rules-adaptation.md, Coach routes; Coaches in Phase 6d): a fare per passenger
// paid through the town's spending threshold, travel along the road by day, nights at waystations
// with food and shelter, and an ambush check each travel day from the terrain's encounter table.
import { VIGOR_QUARTER, vigor } from './arts.ts';
import type { CoachRoute, Site } from '../../data/schemas/index.ts';
import { hexKey, type Hex } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { endOfDay } from './day.ts';
import { meetGroup, rollEnemies } from './encounters.ts';
import { alive, note } from './members.ts';
import { findPath, regionMap, type RegionMap } from './region.ts';
import type { TownResult } from './services.ts';
import { emit } from './bus.ts';
import { enterTown, priceHere, spend, townHere } from './town.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export function coachRoute(data: GameData, id: string): CoachRoute {
  const r = data.content.coachRoutes.find((x) => x.id === id);
  if (!r) throw new Error(`unknown coach route ${id}`);
  return r;
}

/** The routes leaving a town, with the town at the other end. */
export function routesFrom(
  w: World,
  data: GameData,
  townId: string,
): { route: CoachRoute; to: Site }[] {
  const map = regionMap(data, w.region);
  return data.content.coachRoutes.flatMap((route) => {
    const other =
      route.towns[0] === townId
        ? route.towns[1]
        : route.towns[1] === townId
          ? route.towns[0]
          : null;
    const to = other === null ? undefined : map.sites.find((s) => s.id === other);
    return to ? [{ route, to }] : [];
  });
}

/** Everyone riding: the living PCs and the NPCs. */
export const passengers = (w: World) => alive(w).length + w.npcs.length;

export const fareListed = (w: World, data: GameData, routeId: string) =>
  coachRoute(data, routeId).fare * passengers(w);

function roadPath(map: RegionMap, from: Hex, to: Hex): Hex[] | null {
  const road = new Set<string>();
  for (let row = 0; row < map.height; row++)
    for (let col = 0; col < map.width; col++)
      if (map.dangerAt({ col, row }) === 'road') road.add(hexKey({ col, row }));
  return findPath(map, from, to, road);
}

/** Buys passage for everyone and sets off; the party travels with the coach from the next quarter. */
export function boardCoach(w: World, data: GameData, routeId: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  if (w.coach) return no('The party is already on a coach.');
  const here = townHere(w, data);
  const trip = routesFrom(w, data, here.id).find((r) => r.route.id === routeId);
  if (!trip) return no(`No coach runs from ${here.name} on that route.`);
  const path = roadPath(regionMap(data, w.region), w.position, trip.to);
  if (!path) return no(`The road to ${trip.to.name} is cut.`);
  const listed = fareListed(w, data, routeId);
  if (!spend(w, data, listed)) return no(`The fare comes to ${priceHere(w, data, listed)} crowns.`);
  w.coach = { route: routeId, to: trip.to.id, path, checkedDay: null };
  w.destination = null;
  note(w, `The party boards the coach for ${trip.to.name}.`);
  return { ok: true };
}

/** An ambush on the road: the terrain's encounter table, out for a fight whatever the reaction. */
function ambush(w: World, data: GameData): void {
  const map = regionMap(data, w.region);
  const { rows, nature, captive } = rollEnemies(w, data, map.tableAt(w.position));
  meetGroup(
    w,
    data,
    rows,
    nature,
    captive,
    null,
    `Ambush! The coach is set upon at ${hexKey(w.position)}.`,
  );
}

function endCoachQuarter(w: World, data: GameData): void {
  vigor(w, data, VIGOR_QUARTER);
  if (w.quarter < 3) {
    w.quarter += 1;
    return;
  }
  // A night at a waystation: fed, sheltered, and everyone sleeps.
  for (const m of alive(w)) m.slept = true;
  w.camp = 'made';
  w.noRecovery = false;
  endOfDay(w, data, true);
  w.day += 1;
  w.quarter = 0;
}

/** One quarter aboard the coach. Returns false if an encounter must be settled first. */
export function coachQuarter(w: World, data: GameData): boolean {
  const trip = w.coach;
  if (!trip || w.encounter) return false;
  const { hexesPerQuarter, travelQuarters } = data.content.coachRules;
  if (travelQuarters.includes(w.quarter)) {
    if (trip.checkedDay !== w.day) {
      trip.checkedDay = w.day;
      if (w.rng.int(1, coachRoute(data, trip.route).ambushDie) === 1) {
        ambush(w, data);
        return true;
      }
    }
    for (let i = 0; i < hexesPerQuarter && trip.path.length > 0 && !w.encounter; i++) {
      w.position = trip.path.shift() as Hex;
      w.visited.add(hexKey(w.position));
      if (trip.path.length > 0) emit(w, data, { kind: 'hex-entered' });
    }
    if (trip.path.length === 0) {
      w.coach = null;
      enterTown(w, data, trip.to);
    } else note(w, `The coach rolls on to ${hexKey(w.position)}.`);
  } else if (w.quarter === Math.max(...travelQuarters) + 1)
    note(w, 'The coach stops at a waystation.');
  endCoachQuarter(w, data);
  return true;
}
