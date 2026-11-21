import { describe, expect, it } from 'vitest';
import terrains from '../../../data/content/terrains.json' with { type: 'json' };
import { glyphsFor } from '../../../src/render/hex-art.ts';
import { hexCenter, hexPoints, type HexCell } from '../../../src/render/hex-view.ts';
import { GLYPHS, heightOf, ICONS, INK, widthOf } from '../../../src/render/pixel/bitmaps.ts';
import { bitmapMask, blit, paint } from '../../../src/render/pixel/blit.ts';
import { BEYOND, newFrame } from '../../../src/render/pixel/frame.ts';
import { at, ground, isWater } from '../../../src/render/pixel/ground.ts';
import { hexGrid, insideHex, UNIT } from '../../../src/render/pixel/hexgrid.ts';
import { emptyMask } from '../../../src/render/pixel/mask.ts';
import { FOG, landFrame, layout, SEEN, VISITED } from '../../../src/render/pixel/overland.ts';
import {
  marksFrame,
  mixHex,
  overlandLevel,
  overlandLight,
  overlandRGBA,
} from '../../../src/render/pixel/overland-marks.ts';
import { MAT } from '../../../src/render/pixel/palette.ts';
import type { Rasterize } from '../../../src/render/pixel/sprites.ts';
import { levelOf, matOf } from '../../../src/render/pixel/texel.ts';

const SIZE = 18;
const COLS = 5;
const ROWS = 4;
const W = Math.ceil(SIZE * 1.5 * (COLS - 1) + SIZE * 2);
const H = Math.ceil(SIZE * Math.sqrt(3) * (ROWS + 0.5));

function cell(col: number, row: number, over: Partial<HexCell> = {}): HexCell {
  const { x, y } = hexCenter({ col, row }, SIZE);
  return {
    key: `${col},${row}`,
    col,
    row,
    points: hexPoints({ col, row }, SIZE),
    cx: x,
    cy: y,
    terrain: 'plains',
    terrainName: 'Plains',
    label: '',
    road: false,
    visited: true,
    site: null,
    party: false,
    destination: false,
    route: false,
    quest: false,
    questName: null,
    dungeon: null,
    exit: null,
    grove: null,
    lair: null,
    camp: null,
    ...over,
  };
}

/** A small map: every terrain in turn, a road and a river through it, a lake, and fog in a corner. */
function map(): HexCell[] {
  const terrains = [
    'plains',
    'forest',
    'deep-forest',
    'hills',
    'mountains',
    'peaks',
    'swamp',
    'badlands',
    'lake',
    'river',
    'ford',
    'desert',
    'dunes',
    'salt-flats',
    'oasis',
    'mystery',
  ];
  const cells: HexCell[] = [];
  for (let row = 0; row < ROWS; row++)
    for (let col = 0; col < COLS; col++) {
      const i = row * COLS + col;
      const t = terrains[i] ?? 'plains';
      const fog = col === COLS - 1 && row === ROWS - 1;
      cells.push(
        cell(col, row, {
          terrain: fog ? null : t,
          terrainName: fog ? null : t,
          visited: row !== 0,
          road: row === 2,
        }),
      );
    }
  return cells;
}

/** Stands in for the browser: a stroked course covers a band across the middle row of pixels. */
const raster: Rasterize = (s) => {
  const m = emptyMask(s.box.x, s.box.y, s.box.w, s.box.h);
  const y = Math.floor(m.h / 2);
  for (let x = 0; x < m.w; x++) m.on[y * m.w + x] = 1;
  return m;
};

describe('pixel overland: hexes and sprites (docs/presentation-plan.md, V8)', () => {
  it('finds each pixel’s hex, and none outside the map', () => {
    const g = hexGrid(W, H, COLS, ROWS, SIZE);
    expect(g.width).toBe(Math.ceil(W / UNIT));
    expect(hexGrid(W, H, COLS, ROWS, SIZE)).toBe(g);
    const c = hexCenter({ col: 2, row: 1 }, SIZE);
    const px = Math.floor(c.x / UNIT);
    const py = Math.floor(c.y / UNIT);
    expect(g.at[py * g.width + px]).toBe(1 * COLS + 2);
    // The map's top-left corner lies outside every hex.
    expect(g.at[0]).toBe(-1);
    expect(insideHex(0, 0, SIZE)).toBe(true);
    expect(insideHex(SIZE * 0.9, SIZE * 0.8, SIZE)).toBe(false);
    expect(insideHex(0, SIZE, SIZE)).toBe(false);
    // Many grids at once: the oldest are let go.
    for (let n = 0; n < 10; n++) hexGrid(W + n + 1, H, COLS, ROWS, SIZE);
    expect(hexGrid(W, H, COLS, ROWS, SIZE)).not.toBe(g);
  });

  it('has a sprite for every terrain the chart sets glyphs on', () => {
    for (const t of terrains.map((x) => x.id))
      if (glyphsFor(cell(1, 1, { terrain: t }), SIZE).length > 0) expect(GLYPHS[t]).toBeDefined();
  });

  it('draws every sprite in whole rows of known letters', () => {
    for (const b of [...Object.values(GLYPHS), ...Object.values(ICONS)]) {
      expect(new Set(b.rows.map((r) => r.length)).size).toBe(1);
      for (const ch of b.rows.join('')) expect(ch === '.' || ch in INK).toBe(true);
      expect(widthOf(b)).toBeGreaterThan(0);
      expect(heightOf(b)).toBeGreaterThan(0);
    }
  });

  it('blits a sprite centred, outlined if asked, keeping or setting depth', () => {
    const f = newFrame(12, 12);
    blit(f, ICONS.dungeon, 6, 6);
    const m = bitmapMask(ICONS.dungeon, 3, 4);
    expect(m.on.filter(Boolean).length).toBeGreaterThan(10);
    // The outline lies just outside the sprite, and nothing took a new depth.
    expect(f.mat[3 * 12 + 5]).toBe(MAT.void);
    expect(f.depth.every((d) => d === BEYOND)).toBe(true);
    const g = newFrame(12, 12);
    blit(g, GLYPHS.plains as NonNullable<(typeof GLYPHS)['plains']>, 6, 6, 0);
    expect(g.mat).toContain(MAT.grass);
    expect(g.depth).toContain(0);
    // A sprite past the frame's edge is cut, not wrapped.
    blit(g, ICONS.town, -2, -2, 0);
    blit(g, ICONS.town, 13, 13, 0);
    const p = newFrame(4, 4);
    p.depth.fill(SEEN);
    paint(p, emptyMask(0, 0, 4, 4), MAT.dirt, 0.5);
    const line = emptyMask(0, 1, 4, 1);
    line.on.fill(1);
    paint(p, line, MAT.dirt, 0.5);
    expect(p.mat[4]).toBe(MAT.dirt);
    expect(p.mat[0]).toBe(MAT.void);
    expect(p.depth[4]).toBe(SEEN);
  });

  it('gives each terrain its own ground, the same at the same pixel', () => {
    const seen = new Set<number>();
    for (const t of [
      'plains',
      'forest',
      'deep-forest',
      'hills',
      'mountains',
      'peaks',
      'swamp',
      'badlands',
      'lake',
      'desert',
      'oasis',
      'dunes',
      'salt-flats',
    ])
      for (let y = 0; y < 24; y++) for (let x = 0; x < 24; x++) seen.add(matOf(ground(t, x, y)));
    for (const m of [
      MAT.grass,
      MAT.leaf,
      MAT.moss,
      MAT.stone,
      MAT.water,
      MAT.rust,
      MAT.sand,
      MAT.snow,
    ])
      expect(seen).toContain(m);
    expect(ground('swamp', 3, 4)).toBe(ground('swamp', 3, 4));
    expect(matOf(ground('river', 1, 1))).toBe(MAT.grass);
    expect(levelOf(ground('plains', 5, 9)) * 7).toBeCloseTo(
      Math.round(levelOf(ground('plains', 5, 9)) * 7),
      1,
    );
    expect(at(7)).toBe(1);
    expect(isWater('lake')).toBe(true);
    expect(isWater('river')).toBe(false);
  });
});

describe('pixel overland: the land', () => {
  it('lays each hex’s ground, marks visited, seen, and fog, and frays the fog’s edge', () => {
    const cells = map();
    const f = landFrame(cells, SIZE, W, H, raster);
    const l = layout(cells, SIZE, W, H);
    expect(f.width).toBe(l.grid.width);
    const depths = new Set(f.depth);
    for (const d of [VISITED, SEEN, FOG]) expect(depths).toContain(d);
    // Water, a shore of foam and sand, stone, snow on the peaks, rust, and the road's dirt.
    for (const m of [MAT.water, MAT.sand, MAT.stone, MAT.snow, MAT.rust, MAT.dirt, MAT.fog])
      expect(f.mat).toContain(m);
    // A pixel of a known hex beside the fog is sometimes fog itself.
    const fogHex = (ROWS - 1) * COLS + (COLS - 1);
    let frayed = 0;
    for (let i = 0; i < f.depth.length; i++)
      if (f.depth[i] === FOG && l.grid.at[i] !== fogHex && l.grid.at[i] !== -1) frayed++;
    expect(frayed).toBeGreaterThan(0);
  });

  it('draws no river or road where there are none, and bridges where a road crosses one', () => {
    const plain = [cell(0, 0), cell(1, 0)];
    const f = landFrame(plain, SIZE, W, H, raster);
    expect(f.mat).not.toContain(MAT.dirt);
    const crossing = [
      cell(0, 1, { road: true }),
      cell(1, 1, { terrain: 'river', road: true }),
      cell(2, 1, { road: true }),
      cell(1, 0, { terrain: 'river' }),
      cell(1, 2, { terrain: 'river' }),
      cell(3, 0, { terrain: 'ford', road: true }),
      cell(3, 1, { road: true }),
    ];
    const g = landFrame(crossing, SIZE, W, H, raster);
    expect(g.mat).toContain(MAT.wood);
    // A road running north to south lays its bridge's planks the other way.
    const northward = [
      cell(1, 0, { road: true }),
      cell(1, 1, { terrain: 'river', road: true }),
      cell(1, 2, { road: true }),
    ];
    expect(landFrame(northward, SIZE, W, H, raster).mat).toContain(MAT.wood);
  });
});

describe('pixel overland: icons and light', () => {
  it('sets each place’s icon, the party’s banner, and the compass on a clear layer', () => {
    const cells = [
      cell(0, 0, { site: 'Rubblegate', party: true }),
      cell(1, 0, { dungeon: 'The Old Barrow' }),
      cell(2, 0, { grove: 'A grove' }),
      cell(3, 0, { lair: 'A den' }),
      cell(0, 2, { camp: 'A camp' }),
      cell(1, 2, { exit: 'The road east' }),
    ];
    const f = marksFrame(cells, SIZE, W, H);
    for (const m of [MAT.rust, MAT.cloth, MAT.stone, MAT.leaf, MAT.dirt, MAT.gold, MAT.blood])
      expect(f.mat).toContain(m);
    expect(f.depth).toContain(BEYOND);
    const rgba = overlandRGBA(f, overlandLight());
    expect(rgba[3]).toBe(0);
    expect([...rgba].some((v, i) => i % 4 === 3 && v === 255)).toBe(true);
  });

  it('lights the land by the hour: plain by day, tinted and dimmer at night', () => {
    expect(overlandLight()).toEqual({ tint: '#ffffff', bright: 1 });
    expect(overlandLight({ color: '#ffffff', opacity: 0 })).toEqual({ tint: '#ffffff', bright: 1 });
    const night = overlandLight({ color: '#1d2a4a', opacity: 0.42 });
    expect(night.bright).toBeLessThan(0.7);
    expect(night.tint).not.toBe('#ffffff');
    expect(mixHex('#000000', '#ffffff', 0.5)).toBe('#808080');
    expect(mixHex('#ff0000', '#0000ff', 1)).toBe('#0000ff');
    // Seen hexes paler than visited ones; fog dims less than the land at night.
    expect(overlandLevel(0.4, SEEN, 1)).toBeGreaterThan(overlandLevel(0.4, VISITED, 1));
    expect(overlandLevel(0.4, FOG, 0.5) / 0.4).toBeGreaterThan(
      overlandLevel(0.4, VISITED, 0.5) / 0.4,
    );
    const land = landFrame(map(), SIZE, W, H, raster);
    const sum = (a: Uint8ClampedArray) => a.reduce((s, v) => s + v, 0);
    expect(sum(overlandRGBA(land, night))).toBeLessThan(sum(overlandRGBA(land, overlandLight())));
  });
});
