// Trade-route maps (Sam's call; docs/rules-adaptation.md, Towns in Phase 6a: Trade-route maps): in
// a town's tavern, a cheap map shows the roads from the town to each town or road out of the region
// they reach, and every hex beside them. The map shows those hexes from then on.
import { hexKey, neighbors, parseHexKey, type Hex } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { note } from './members.ts';
import { knownHexes, regionMap, type RegionMap } from './region.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export const routeMapListed = (data: GameData) => data.content.townRules.routeMap;

export interface TradeRoutes {
  /** The towns the roads reach, nearest first. */
  towns: string[];
  /** The roads out of the region they reach, nearest first. */
  exits: string[];
  /** The roads' hexes and every hex beside them. */
  hexes: Set<string>;
}

/** The roads from `from` to the first town or road out along each, by a breadth-first walk. */
export function tradeRoutes(map: RegionMap, from: Hex): TradeRoutes {
  const parent = new Map<string, Hex | null>([[hexKey(from), null]]);
  const towns: string[] = [];
  const exits: string[] = [];
  const ends: Hex[] = [];
  const queue: Hex[] = [from];
  for (let h = queue.shift(); h; h = queue.shift()) {
    for (const n of neighbors(h)) {
      const key = hexKey(n);
      if (!map.inBounds(n) || parent.has(key)) continue;
      const town = map.siteAt(n)?.name;
      const exit = town ? undefined : map.exitAt(n)?.name;
      if (!town && !exit && map.dangerAt(n) !== 'road') continue;
      parent.set(key, h);
      if (town) towns.push(town);
      if (exit) exits.push(exit);
      if (town || exit) ends.push(n);
      else queue.push(n);
    }
  }
  const road = new Set<string>();
  for (const end of ends)
    for (let h: Hex | null = end; h; h = parent.get(hexKey(h)) ?? null) road.add(hexKey(h));
  const hexes = new Set(road);
  for (const key of road)
    for (const n of neighbors(parseHexKey(key))) if (map.inBounds(n)) hexes.add(hexKey(n));
  return { towns, exits, hexes };
}

const and = (xs: string[], last = ' and ') =>
  xs.length < 2 ? (xs[0] ?? '') : `${xs.slice(0, -1).join(', ')}${last}${xs.at(-1)}`;

/** "the roads to Dustwell and Tinker's Oasis, and the road east to The Glassed Flats". */
export function routesText(r: Pick<TradeRoutes, 'towns' | 'exits'>): string {
  const roads = r.towns.length === 1 ? 'the road' : 'the roads';
  const parts = [...(r.towns.length > 0 ? [`${roads} to ${and(r.towns)}`] : []), ...r.exits];
  return and(parts, r.towns.length > 1 ? ', and ' : ' and ');
}

/** The town's map and the hexes on it the party doesn't know, or why there is nothing to sell. */
function offer(w: World, data: GameData): { routes: TradeRoutes; fresh: string[] } | string {
  const town = townHere(w, data);
  const map = regionMap(data, w.region);
  const routes = tradeRoutes(map, town);
  if (routes.hexes.size === 0) return `No road leads from ${town.name} to another town.`;
  const known = knownHexes(map, w);
  const fresh = [...routes.hexes].filter((k) => !known.has(k));
  return fresh.length > 0 ? { routes, fresh } : 'The party already knows these roads.';
}

/** Why the town's tavern has no map to sell the party, or null if it has one. */
export function routeMapRefusal(w: World, data: GameData): string | null {
  const o = offer(w, data);
  return typeof o === 'string' ? o : null;
}

/** Buys the town's trade-route map, unless the party already knows every hex it shows. */
export function buyRouteMap(w: World, data: GameData): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const o = offer(w, data);
  if (typeof o === 'string') return no(o);
  const listed = routeMapListed(data);
  if (!spend(w, data, listed)) return no(`That costs ${priceHere(w, data, listed)} crowns.`);
  w.routes[w.region] = [...(w.routes[w.region] ?? []), ...o.fresh];
  note(w, `In ${townHere(w, data).name}, the party buys a map of ${routesText(o.routes)}.`);
  return { ok: true };
}
