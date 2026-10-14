// Trade-route maps (Sam's call; docs/rules-adaptation.md, Towns in Phase 6a: Trade-route maps): in
// a town's tavern, a cheap map shows the roads from the town to each town or road out of the region
// they reach, with a hex on either side. The map shows those hexes from then on.
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
  /** The towns and roads out the roads reach, nearest first. */
  reached: string[];
  /** The roads' hexes and those either side of them. */
  hexes: Set<string>;
}

/** The roads from `from` to the first town or road out along each, by a breadth-first walk. */
export function tradeRoutes(map: RegionMap, from: Hex): TradeRoutes {
  const parent = new Map<string, Hex | null>([[hexKey(from), null]]);
  const ends: Hex[] = [];
  const queue: Hex[] = [from];
  for (let h = queue.shift(); h; h = queue.shift()) {
    for (const n of neighbors(h)) {
      const key = hexKey(n);
      if (!map.inBounds(n) || parent.has(key)) continue;
      const end = map.siteAt(n) ?? map.exitAt(n);
      if (!end && map.dangerAt(n) !== 'road') continue;
      parent.set(key, h);
      if (end) ends.push(n);
      else queue.push(n);
    }
  }
  const road = new Set<string>();
  for (const end of ends)
    for (let h: Hex | null = end; h; h = parent.get(hexKey(h)) ?? null) road.add(hexKey(h));
  const hexes = new Set(road);
  for (const key of road)
    for (const n of neighbors(parseHexKey(key))) if (map.inBounds(n)) hexes.add(hexKey(n));
  const reached = ends.map((h) => (map.siteAt(h) ?? map.exitAt(h))?.name as string);
  return { reached, hexes };
}

/** Buys the town's trade-route map, unless the party already knows every hex it shows. */
export function buyRouteMap(w: World, data: GameData): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  const map = regionMap(data, w.region);
  const { reached, hexes } = tradeRoutes(map, town);
  if (reached.length === 0) return no(`No road leads from ${town.name} to another town.`);
  const known = knownHexes(map, w);
  const fresh = [...hexes].filter((k) => !known.has(k));
  if (fresh.length === 0) return no('The party already knows these roads.');
  const listed = routeMapListed(data);
  if (!spend(w, data, listed)) return no(`That costs ${priceHere(w, data, listed)} crowns.`);
  w.routes[w.region] = [...(w.routes[w.region] ?? []), ...fresh];
  note(w, `In ${town.name}, the party buys a map of the roads to ${reached.join(', ')}.`);
  return { ok: true };
}
