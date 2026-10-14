// Read-only drawing data for the overland map: flat-topped hexes in odd-q layout
// (src/rules/hex.ts), fog over unseen hexes, sites, the party, and the planned route.
import { knownHexes, type RegionMap } from '../game/world/region.ts';
import type { World } from '../game/world/types.ts';
import { hexKey, type Hex } from '../rules/hex.ts';

export interface HexCell {
  key: string;
  col: number;
  row: number;
  /** SVG polygon points. */
  points: string;
  cx: number;
  cy: number;
  /** Terrain id and name, or null under fog. */
  terrain: string | null;
  label: string;
  road: boolean;
  visited: boolean;
  site: string | null;
  party: boolean;
  destination: boolean;
  route: boolean;
  /** A quest step waits here; shown even under fog, since the giver said where. */
  quest: boolean;
  /** A dungeon entrance's name, once the hex is known or a rumor has told of it. */
  dungeon: string | null;
  /** A road off the map, once the hex is known (Phase 12). */
  exit: string | null;
  /** A grove of walking trees not yet cleared, once the hex is known. */
  grove: string | null;
}

const SQRT3 = Math.sqrt(3);

export function hexCenter(h: Hex, size: number): { x: number; y: number } {
  return {
    x: size + size * 1.5 * h.col,
    y: (size * SQRT3) / 2 + size * SQRT3 * (h.row + (h.col % 2) * 0.5),
  };
}

export function hexPoints(h: Hex, size: number): string {
  const { x, y } = hexCenter(h, size);
  return Array.from({ length: 6 }, (_, i) => {
    const angle = (Math.PI / 3) * i;
    return `${(x + size * Math.cos(angle)).toFixed(1)},${(y + size * Math.sin(angle)).toFixed(1)}`;
  }).join(' ');
}

export function mapPixels(map: RegionMap, size: number): { width: number; height: number } {
  return {
    width: Math.ceil(size * 1.5 * (map.width - 1) + size * 2),
    height: Math.ceil(size * SQRT3 * (map.height + 0.5)),
  };
}

export function hexCells(
  map: RegionMap,
  w: World,
  routeHexes: Hex[],
  size: number,
  questHexes: readonly Hex[] = [],
  entrances: readonly (Hex & { name: string; heard?: boolean })[] = [],
  groves: readonly (Hex & { name: string })[] = [],
  /** Hexes the party knows of without having seen them, such as a freed captive's home. */
  revealed: readonly Hex[] = [],
): HexCell[] {
  const quests = new Set(questHexes.map(hexKey));
  const ways = new Map(entrances.map((e) => [hexKey(e), e]));
  const woods = new Map(groves.map((g) => [hexKey(g), g.name]));
  const seen = knownHexes(map, w);
  for (const h of revealed) seen.add(hexKey(h));
  const onRoute = new Set(routeHexes.map(hexKey));
  const cells: HexCell[] = [];
  for (let row = 0; row < map.height; row++) {
    for (let col = 0; col < map.width; col++) {
      const h = { col, row };
      const key = hexKey(h);
      const known = seen.has(key);
      const terrain = map.terrainAt(h);
      const site = known ? (map.siteAt(h)?.name ?? null) : null;
      const { x, y } = hexCenter(h, size);
      cells.push({
        key,
        col,
        row,
        points: hexPoints(h, size),
        cx: x,
        cy: y,
        terrain: known ? terrain.id : null,
        label: known ? `${site ?? terrain.name} (${key})` : `Unexplored (${key})`,
        road: known && map.dangerAt(h) === 'road',
        visited: w.visited.has(key),
        site,
        party: key === hexKey(w.position),
        destination: w.destination !== null && key === hexKey(w.destination),
        route: onRoute.has(key),
        quest: quests.has(key),
        dungeon: known || ways.get(key)?.heard ? (ways.get(key)?.name ?? null) : null,
        exit: known ? (map.exitAt(h)?.name ?? null) : null,
        grove: known ? (woods.get(key) ?? null) : null,
      });
    }
  }
  return cells;
}
