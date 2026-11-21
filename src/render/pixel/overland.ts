// The overland map as pixel art (docs/presentation-plan.md, V8): the land layer, one pixel for
// every two map units. Each pixel takes its hex's ground (ground.ts); hex edges are a step darker,
// more so where the terrain changes; lakes get a pale shore line and the land beside them a sandy
// one; rivers and roads follow the vector chart's own courses (hex-art.ts); each terrain's glyphs
// and the bridges stand on top (bitmaps.ts); and the fog of the unknown eats a dithered edge into
// what the party knows. A pixel's depth says whether its hex is visited, only seen, or unknown,
// for the light (overland-light.ts).
import { glyphsFor, riverPath, roadPath } from '../hex-art.ts';
import type { HexCell } from '../hex-view.ts';
import { bridges } from '../hex-water.ts';
import { scale } from './affine.ts';
import { GLYPHS, ICONS, type Bitmap } from './bitmaps.ts';
import { blit, paint } from './blit.ts';
import { newFrame, put, type Frame } from './frame.ts';
import { at, ground, isWater } from './ground.ts';
import { hexGrid, UNIT, type HexGrid } from './hexgrid.ts';
import { bayer, MAT } from './palette.ts';
import type { Rasterize, Shape } from './sprites.ts';
import { levelOf, matOf, noise } from './texel.ts';

/** A pixel's depth on the overland: its hex visited, seen but not visited, or unknown. */
export const VISITED = 0;
export const SEEN = 1;
export const FOG = 2;

/** The map's hexes laid out on its pixels, and each pixel's hex. */
export interface Layout {
  grid: HexGrid;
  /** The hex at a pixel, or undefined outside every hex. */
  cellAt: (i: number) => HexCell | undefined;
}

export function layout(cells: readonly HexCell[], size: number, w: number, h: number): Layout {
  const cols = Math.max(0, ...cells.map((c) => c.col + 1));
  const rows = Math.max(0, ...cells.map((c) => c.row + 1));
  const grid = hexGrid(w, h, cols, rows, size);
  const byIndex: (HexCell | undefined)[] = [];
  for (const c of cells) byIndex[c.row * cols + c.col] = c;
  return { grid, cellAt: (i) => byIndex[grid.at[i] as number] };
}

/** The ground's step darker along hex edges, and darker still where the terrain changes. */
const EDGE = 0.07;
const BORDER = 1 / 7;

/** Hex edges, and the shore where a lake meets known land. */
function edges(f: Frame, l: Layout): void {
  const terrain = (i: number) => l.cellAt(i)?.terrain ?? null;
  const shore: [number, boolean][] = [];
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = y * f.width + x;
      const t = terrain(i);
      if (!t) continue;
      // Neighbours past the frame's edge are the pixel itself, which changes nothing.
      const nb = (nx: number, ny: number) =>
        Math.min(f.width - 1, Math.max(0, nx)) + Math.min(f.height - 1, Math.max(0, ny)) * f.width;
      const near = [nb(x + 1, y), nb(x, y + 1)];
      const sides = [...near, nb(x - 1, y), nb(x, y - 1)].map(terrain);
      const meets = sides.find((s) => s !== null && isWater(s) !== isWater(t));
      if (meets !== undefined) shore.push([i, isWater(t)]);
      for (const j of near) {
        if (l.grid.at[j] === l.grid.at[i]) continue;
        f.level[i] = Math.max(0, (f.level[i] as number) - (terrain(j) === t ? EDGE : BORDER));
      }
    }
  // Foam on the water's side, sand on the land's.
  for (const [i, wet] of shore)
    if (wet) put(f, i, MAT.water, at(6), f.depth[i] as number);
    else put(f, i, MAT.sand, at(4), f.depth[i] as number);
}

/** A course from the vector chart, stroked `width` map units wide, over the whole layer. */
const course = (d: string, width: number, f: Frame): Shape => ({
  d,
  stroke: width,
  matrix: scale(1 / UNIT),
  box: { x: 0, y: 0, w: f.width, h: f.height },
});

/** Rivers, a pale thread down their middle, and roads. */
function courses(f: Frame, cells: HexCell[], raster: Rasterize): void {
  const river = riverPath(cells);
  if (river) {
    paint(f, raster(course(river, 4.4, f)), MAT.water, at(4));
    paint(f, raster(course(river, 1.4, f)), MAT.water, at(6));
  }
  const road = roadPath(cells);
  if (road) paint(f, raster(course(road, 2.2, f)), MAT.dirt, at(3));
}

/** Each known hex's glyphs, nearer the bottom drawn last, then the bridges. */
function glyphs(f: Frame, cells: HexCell[], size: number): void {
  const all = cells.flatMap((c) =>
    // Every terrain with glyphs has a bitmap (tests/render/pixel/overland.test.ts).
    glyphsFor(c, size).map((g) => ({ ...g, bitmap: GLYPHS[c.terrain as string] as Bitmap })),
  );
  all.sort((a, b) => a.y - b.y);
  for (const g of all) blit(f, g.bitmap, g.x / UNIT, g.y / UNIT);
  for (const b of bridges(cells)) {
    const across = Math.abs(Math.cos((b.angle * Math.PI) / 180)) > 0.5;
    blit(f, across ? ICONS.bridgeAcross : ICONS.bridgeAlong, b.x / UNIT, b.y / UNIT);
  }
}

/** Fog over what the party doesn't know, its edge dithered a pixel or two into what it does. */
function fog(f: Frame, l: Layout): void {
  const unknown = new Uint8Array(f.width * f.height);
  for (let i = 0; i < unknown.length; i++) if (!l.cellAt(i)?.terrain) unknown[i] = 1;
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = y * f.width + x;
      if (unknown[i]) {
        // Flecked here and there, so the unknown reads as old paper rather than a hole.
        put(f, i, MAT.fog, at(noise(0xf09, x, y) < 0.05 ? 3 : 2), FOG);
        continue;
      }
      let d = 3;
      for (let dy = -2; dy <= 2; dy++)
        for (let dx = -2; dx <= 2; dx++) {
          const [nx, ny] = [x + dx, y + dy];
          if (nx < 0 || ny < 0 || nx >= f.width || ny >= f.height) continue;
          if (unknown[ny * f.width + nx]) d = Math.min(d, Math.max(Math.abs(dx), Math.abs(dy)));
        }
      if ((d === 1 && bayer(x, y) < 0.6) || (d === 2 && bayer(x, y) < 0.25))
        put(f, i, MAT.fog, at(2), FOG);
    }
}

/** The land layer for a map `w` by `h` map units. */
export function landFrame(
  cells: HexCell[],
  size: number,
  w: number,
  h: number,
  raster: Rasterize,
): Frame {
  const l = layout(cells, size, w, h);
  const f = newFrame(l.grid.width, l.grid.height);
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = y * f.width + x;
      const c = l.cellAt(i);
      if (!c?.terrain) continue;
      const t = ground(c.terrain, x, y);
      put(f, i, matOf(t), levelOf(t), c.visited ? VISITED : SEEN);
    }
  edges(f, l);
  courses(f, cells, raster);
  glyphs(f, cells, size);
  fog(f, l);
  return f;
}
