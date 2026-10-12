// The overland map editor's model (Sam's calls): painting terrain and danger, placing and naming
// settlements, putting dungeons on the map, and checking the map with the same checks the shipped
// regions pass.
import { dungeonReferenceErrors } from '../../data/dungeon-check.ts';
import { overlandReferenceErrors } from '../../data/overland-check.ts';
import type {
  ContentData,
  Dungeon,
  Region,
  Site,
  SrdData,
  Terrain,
  TownSize,
} from '../../data/schemas/index.ts';
import { distance, type Hex } from '../../rules/hex.ts';
import type { Rng } from '../../rules/rng.ts';
import { largestSite, newSite } from './map-gen.ts';

const putAt = (rows: readonly string[], h: Hex, ch: string) =>
  rows.map((r, i) => (i === h.row ? `${r.slice(0, h.col)}${ch}${r.slice(h.col + 1)}` : r));

const inBounds = (r: Region, h: Hex) =>
  h.row >= 0 && h.col >= 0 && h.row < r.terrain.length && h.col < (r.terrain[0] as string).length;

export const siteAt = (r: Region, h: Hex) =>
  r.sites.find((s) => s.col === h.col && s.row === h.row);

/** Paints a hex's terrain by glyph. */
export const paintTerrain = (r: Region, h: Hex, glyph: string): Region =>
  inBounds(r, h) ? { ...r, terrain: putAt(r.terrain, h, glyph) } : r;

/** Paints a hex's danger by overlay glyph: `=` road, `.` ordinary, `!` dangerous. */
export const paintDanger = (r: Region, h: Hex, glyph: string): Region =>
  inBounds(r, h) ? { ...r, overlay: putAt(r.overlay, h, glyph) } : r;

/** A new settlement on a hex with none; the map is unchanged where one already stands. */
export function placeSite(
  content: ContentData,
  rng: Rng,
  r: Region,
  h: Hex,
  size: TownSize,
): Region {
  if (!inBounds(r, h) || siteAt(r, h)) return r;
  return { ...r, sites: [...r.sites, newSite(content, rng, r, h, size)] };
}

/** Renames or resizes a settlement; a blank name is ignored. */
export function updateSite(
  r: Region,
  id: string,
  patch: { name?: string; size?: TownSize },
): Region {
  const name = patch.name?.trim();
  return {
    ...r,
    sites: r.sites.map((s): Site =>
      s.id === id
        ? { ...s, ...(name ? { name } : {}), ...(patch.size ? { size: patch.size } : {}) }
        : s,
    ),
  };
}

/** Removes a settlement, but never the last; the start moves to the largest left if need be. */
export function removeSite(r: Region, id: string): Region {
  const sites = r.sites.filter((s) => s.id !== id);
  if (sites.length === 0) return r;
  const start = sites.some((s) => s.id === r.start) ? r.start : (largestSite(sites) as Site).id;
  return { ...r, sites, start };
}

export const setStart = (r: Region, id: string): Region =>
  r.sites.some((s) => s.id === id) ? { ...r, start: id } : r;

export const renameRegion = (r: Region, name: string): Region =>
  name.trim() ? { ...r, name: name.trim() } : r;

/** The dungeon with its entrance on a hex of the map. */
export const placeDungeon = (d: Dungeon, r: Region, h: Hex): Dungeon => ({
  ...d,
  region: r.id,
  entrance: { col: h.col, row: h.row },
});

/**
 * A hex a dungeon entrance can go on, nearest the middle: passable land with no settlement and no
 * other entrance, or null if there is none.
 */
export function freeHex(
  terrains: readonly Terrain[],
  r: Region,
  taken: readonly Hex[] = [],
): Hex | null {
  const glyphs = new Map(terrains.map((t) => [t.glyph, t]));
  const mid = {
    col: Math.floor((r.terrain[0] as string).length / 2),
    row: Math.floor(r.terrain.length / 2),
  };
  let best: Hex | null = null;
  for (const [row, line] of r.terrain.entries())
    for (const [col, g] of [...line].entries()) {
      const h = { col, row };
      const t = glyphs.get(g);
      if (!t || t.movement === 'impassable') continue;
      if (siteAt(r, h) || taken.some((t) => t.col === col && t.row === row)) continue;
      if (best === null || distance(h, mid) < distance(best, mid)) best = h;
    }
  return best;
}

/**
 * The map's problems: the overland checks for this region, and the entrances of the dungeons on
 * it. `content` is everything else, saved work included.
 */
export function mapErrors(
  srd: SrdData,
  content: ContentData,
  r: Region,
  dungeons: readonly Dungeon[],
): string[] {
  const next: ContentData = {
    ...content,
    regions: [...content.regions.filter((x) => x.id !== r.id), r],
    dungeons: [
      ...content.dungeons.filter((d) => !dungeons.some((x) => x.id === d.id)),
      ...dungeons,
    ],
  };
  const region = `regions/${r.id}`;
  const here = new Set(dungeons.filter((d) => d.region === r.id).map((d) => `dungeons/${d.id}:`));
  const entrance = (e: string) =>
    [...here].some((p) => e.startsWith(p)) && /entrance|unknown region/.test(e);
  return [
    ...overlandReferenceErrors(srd, next).filter(
      (e) => e.startsWith(`${region}:`) || e.startsWith(`${region}/`),
    ),
    ...dungeonReferenceErrors(next).filter(entrance),
  ];
}
