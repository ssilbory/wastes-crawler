// Random overland regions for the map editor (Sam's call: an authoring tool, not a rule). Terrain
// comes from height and wetness fields through data/content/map-gen.json's biomes; settlements
// stand on passable land, spaced apart, joined by roads along the cheapest routes; wild biomes far
// from any settlement are dangerous. The result is a region in the shape of regions.json.
import {
  TownSizeSchema,
  type ContentData,
  type Region,
  type Site,
  type TownSize,
} from '../../data/schemas/index.ts';
import { distance, hexKey, type Hex } from '../../rules/hex.ts';
import type { Rng } from '../../rules/rng.ts';
import { findPath, regionMapOf } from '../world/region.ts';
import { slug, uniqueId } from './library.ts';
import { noiseField } from './noise.ts';

export interface MapGenOptions {
  id: string;
  name: string;
  width: number;
  height: number;
  settlements: number;
}

const SIZES = TownSizeSchema.options;

function shuffle<T>(rng: Rng, list: T[]): T[] {
  for (let i = list.length - 1; i > 0; i--) {
    const j = rng.int(0, i);
    [list[i], list[j]] = [list[j] as T, list[i] as T];
  }
  return list;
}

function pick<T>(rng: Rng, list: readonly T[]): T {
  return list[rng.int(0, list.length - 1)] as T;
}

function rollSize(content: ContentData, rng: Rng): TownSize {
  const { sizes } = content.mapGen;
  const total = SIZES.reduce((sum, s) => sum + sizes[s], 0);
  if (total <= 0) return SIZES[0] as TownSize;
  const roll = rng.int(1, total);
  let sum = 0;
  return SIZES.find((s) => (sum += sizes[s]) >= roll) as TownSize;
}

/** A settlement name not already used: one part of each list, then a number if they run out. */
export function settlementName(content: ContentData, rng: Rng, taken: Iterable<string>): string {
  const used = new Set(taken);
  const { first, second } = content.mapGen.names;
  for (let tries = 0; tries < 30; tries++) {
    const name = `${pick(rng, first)}${pick(rng, second)}`;
    if (!used.has(name)) return name;
  }
  const base = `${pick(rng, first)}${pick(rng, second)}`;
  let n = 2;
  while (used.has(`${base} ${n}`)) n += 1;
  return `${base} ${n}`;
}

/** A new settlement of the given size at a hex, named and with an id unique on the map. */
export function newSite(
  content: ContentData,
  rng: Rng,
  region: Pick<Region, 'id' | 'sites'>,
  at: Hex,
  size: TownSize,
): Site {
  const name = settlementName(
    content,
    rng,
    region.sites.map((s) => s.name),
  );
  const id = uniqueId(
    `${region.id}-${slug(name, 'town')}`,
    region.sites.map((s) => s.id),
  );
  return { id, name, kind: 'town', size, col: at.col, row: at.row };
}

/** The largest settlement, first among equals: where a new party starts. */
export function largestSite(sites: readonly Site[]): Site | undefined {
  return [...sites].sort((a, b) => SIZES.indexOf(b.size) - SIZES.indexOf(a.size))[0];
}

const put = (rows: string[], h: Hex, ch: string) => {
  const r = rows[h.row] as string;
  rows[h.row] = `${r.slice(0, h.col)}${ch}${r.slice(h.col + 1)}`;
};

/** Rolls a whole region. Width and height are clamped to 4–60, settlements to 1–30. */
export function generateRegion(content: ContentData, rng: Rng, o: MapGenOptions): Region {
  const width = Math.min(60, Math.max(4, Math.floor(o.width)));
  const height = Math.min(60, Math.max(4, Math.floor(o.height)));
  const count = Math.min(30, Math.max(1, Math.floor(o.settlements)));
  const gen = content.mapGen;
  const byId = new Map(content.terrains.map((t) => [t.id, t]));
  const heights = noiseField(rng, width, height);
  const wets = noiseField(rng, width, height);
  const inRange = (v: number, [lo, hi]: readonly [number, number]) => v >= lo && v <= hi;
  const biomes = heights.map((r, row) =>
    r.map((h, col) => {
      const wet = (wets[row] as number[])[col] as number;
      return (
        gen.biomes.find((b) => inRange(h, b.height) && inRange(wet, b.wet)) ??
        (gen.biomes[gen.biomes.length - 1] as (typeof gen.biomes)[0])
      );
    }),
  );
  const glyphOf = (id: string) => byId.get(id)?.glyph ?? '?';
  const terrain = biomes.map((r) => r.map((b) => glyphOf(b.terrain)).join(''));
  const passable = (h: Hex) => byId.get(biomesAt(h).terrain)?.movement !== 'impassable';
  function biomesAt(h: Hex) {
    return (biomes[h.row] as (typeof gen.biomes)[0][])[h.col] as (typeof gen.biomes)[0];
  }

  // Settlements: open land first, spaced apart, closing the spacing up if the land runs out.
  const hexes: Hex[] = [];
  for (let row = 0; row < height; row++)
    for (let col = 0; col < width; col++) hexes.push({ col, row });
  const movementOf = (h: Hex) => byId.get(biomesAt(h).terrain)?.movement;
  const candidates = shuffle(rng, hexes.filter(passable)).sort(
    (a, b) => Number(movementOf(b) === 'open') - Number(movementOf(a) === 'open'),
  );
  if (candidates.length === 0) {
    // Nowhere to stand: the middle becomes the first passable biome's land.
    const land = gen.biomes.find((b) => byId.get(b.terrain)?.movement !== 'impassable');
    const mid = { col: Math.floor(width / 2), row: Math.floor(height / 2) };
    if (land) put(terrain, mid, glyphOf(land.terrain));
    candidates.push(mid);
  }
  const spots: Hex[] = [];
  for (let gap = gen.spacing; gap >= 1 && spots.length < count; gap--)
    for (const h of candidates)
      if (spots.length < count && spots.every((s) => distance(s, h) >= gap)) spots.push(h);
  const sites: Site[] = [];
  for (const at of spots)
    sites.push(newSite(content, rng, { id: o.id, sites }, at, rollSize(content, rng)));

  // Danger, then roads joining each settlement to the nearest already joined.
  const overlay = biomes.map((r, row) =>
    r
      .map((b, col) =>
        b.dangerous && sites.every((s) => distance(s, { col, row }) > gen.safeRadius) ? '!' : '.',
      )
      .join(''),
  );
  const start = largestSite(sites) as Site;
  const region: Region = {
    id: o.id,
    name: o.name,
    terrain,
    overlay,
    sites,
    start: start.id,
    exits: [],
    garrisons: [],
    encounters: {},
  };
  const known = new Set(hexes.map(hexKey));
  const joined: Site[] = [start];
  const waiting = sites.filter((s) => s !== start);
  put(overlay, start, '=');
  while (waiting.length > 0) {
    let best = { i: 0, to: joined[0] as Site, d: Infinity };
    for (const [i, s] of waiting.entries())
      for (const j of joined) if (distance(s, j) < best.d) best = { i, to: j, d: distance(s, j) };
    const [from] = waiting.splice(best.i, 1) as [Site];
    joined.push(from);
    put(overlay, from, '=');
    // Roads already laid are cheaper, so new ones join them.
    const path = findPath(regionMapOf(content.terrains, region), from, best.to, known);
    for (const h of path ?? []) put(overlay, h, '=');
  }
  return region;
}
