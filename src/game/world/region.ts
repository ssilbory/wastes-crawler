// An overland region from data/content/regions.json: terrain and danger per hex, sites, and
// routes (docs/rules-adaptation.md, Overland map and Terrain).
import {
  DANGER_GLYPHS,
  type Danger,
  type RegionExit,
  type Site,
  type Terrain,
} from '../../data/schemas/index.ts';
import { hexKey, neighbors, type Hex } from '../../rules/hex.ts';
import { moveCost } from '../../rules/overland.ts';
import type { GameData } from '../character/context.ts';

export interface RegionMap {
  id: string;
  name: string;
  width: number;
  height: number;
  sites: Site[];
  start: Site;
  inBounds: (h: Hex) => boolean;
  terrainAt: (h: Hex) => Terrain;
  dangerAt: (h: Hex) => Danger;
  siteAt: (h: Hex) => Site | undefined;
  exits: RegionExit[];
  exitAt: (h: Hex) => RegionExit | undefined;
  /** The wandering encounter table for a hex: the region's for its terrain, or the terrain's. */
  tableAt: (h: Hex) => string;
  /** Hike points to enter the hex, or null if it can't be entered. */
  costOf: (h: Hex) => number | null;
}

export function regionMap(data: GameData, id: string): RegionMap {
  const r = data.content.regions.find((x) => x.id === id);
  if (!r) throw new Error(`unknown region ${id}`);
  const glyphs = new Map(data.content.terrains.map((t) => [t.glyph, t]));
  const width = (r.terrain[0] as string).length;
  const height = r.terrain.length;
  const inBounds = (h: Hex) => h.col >= 0 && h.row >= 0 && h.col < width && h.row < height;
  const terrainAt = (h: Hex) =>
    glyphs.get((r.terrain[h.row] as string)[h.col] as string) as Terrain;
  const dangerAt = (h: Hex) =>
    DANGER_GLYPHS[(r.overlay[h.row] as string)[h.col] as string] as Danger;
  return {
    id: r.id,
    name: r.name,
    width,
    height,
    sites: r.sites,
    start: r.sites.find((s) => s.id === r.start) as Site,
    inBounds,
    terrainAt,
    dangerAt,
    siteAt: (h) => r.sites.find((s) => s.col === h.col && s.row === h.row),
    exits: r.exits,
    exitAt: (h) => r.exits.find((e) => e.col === h.col && e.row === h.row),
    tableAt: (h) => r.encounters[terrainAt(h).id] ?? terrainAt(h).encounters,
    costOf: (h) => (inBounds(h) ? moveCost(terrainAt(h).movement, dangerAt(h) === 'road') : null),
  };
}

/** Hexes the party has been in, and every hex next to one. */
export function seenHexes(map: RegionMap, visited: ReadonlySet<string>): Set<string> {
  const seen = new Set(visited);
  for (const key of visited) {
    const [col, row] = key.split(',').map(Number) as [number, number];
    for (const n of neighbors({ col, row })) if (map.inBounds(n)) seen.add(hexKey(n));
  }
  return seen;
}

/**
 * The cheapest route by hike points through hexes the party knows (seen), ending at `to`. Returns
 * the hexes after `from`, or null if there's no route.
 */
export function findPath(
  map: RegionMap,
  from: Hex,
  to: Hex,
  known: ReadonlySet<string>,
): Hex[] | null {
  const goal = hexKey(to);
  if (!known.has(goal) || map.costOf(to) === null) return null;
  const best = new Map<string, number>([[hexKey(from), 0]]);
  const prev = new Map<string, Hex>();
  const open: { hex: Hex; cost: number }[] = [{ hex: from, cost: 0 }];
  while (open.length > 0) {
    open.sort((a, b) => a.cost - b.cost);
    const { hex, cost } = open.shift() as { hex: Hex; cost: number };
    const key = hexKey(hex);
    if (key === goal) break;
    // A stale queue entry relaxes nothing, since every neighbor already has a cheaper cost.
    for (const n of neighbors(hex)) {
      const step = map.costOf(n);
      const nKey = hexKey(n);
      if (step === null || !known.has(nKey)) continue;
      const next = cost + step;
      if (next < (best.get(nKey) ?? Infinity)) {
        best.set(nKey, next);
        prev.set(nKey, hex);
        open.push({ hex: n, cost: next });
      }
    }
  }
  if (!prev.has(goal)) return null;
  const path: Hex[] = [];
  for (let h: Hex | undefined = to; h && hexKey(h) !== hexKey(from); h = prev.get(hexKey(h)))
    path.unshift(h);
  return path;
}
