import { describe, expect, it } from 'vitest';
import {
  dayTint,
  glyphsFor,
  HEX_MILES,
  riverPath,
  roadPath,
  scaleBar,
} from '../../src/render/hex-art.ts';
import { hexCenter, hexPoints, type HexCell } from '../../src/render/hex-view.ts';

const SIZE = 18;

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
    label: '',
    road: false,
    visited: true,
    site: null,
    party: false,
    destination: false,
    route: false,
    quest: false,
    dungeon: null,
    exit: null,
    grove: null,
    lair: null,
    ...over,
  };
}
const segments = (d: string) => d.split('M').length - 1;

describe('overland glyphs', () => {
  it('scatters each terrain’s glyphs about its hex, the same on every visit', () => {
    const forest = glyphsFor(cell(3, 4, { terrain: 'forest' }), SIZE);
    expect(forest).toHaveLength(3);
    expect(forest.every((g) => g.symbol === 'hg-forest')).toBe(true);
    expect(glyphsFor(cell(3, 4, { terrain: 'forest' }), SIZE)).toEqual(forest);
    expect(glyphsFor(cell(3, 5, { terrain: 'forest' }), SIZE)).not.toEqual(forest);
    const c = cell(3, 4);
    for (const g of glyphsFor(cell(3, 4, { terrain: 'deep-forest' }), SIZE)) {
      expect(Math.hypot(g.x - c.cx, g.y - c.cy)).toBeLessThan(SIZE * 0.7);
      expect(g.size).toBeGreaterThan(0);
    }
    expect(glyphsFor(cell(0, 0, { terrain: 'deep-forest' }), SIZE)).toHaveLength(5);
  });

  it('draws nothing under fog or for a terrain it has no glyph for', () => {
    expect(glyphsFor(cell(1, 1, { terrain: null }), SIZE)).toEqual([]);
    expect(glyphsFor(cell(1, 1, { terrain: 'glacier' }), SIZE)).toEqual([]);
  });

  it('keeps the middle of a hex clear for a town, dungeon, or grove', () => {
    // A lake's one ripple sits dead centre, so a site on the shore hides it.
    expect(glyphsFor(cell(2, 2, { terrain: 'lake' }), SIZE)).toHaveLength(1);
    expect(glyphsFor(cell(2, 2, { terrain: 'lake', site: 'Rubblegate' }), SIZE)).toEqual([]);
    expect(glyphsFor(cell(2, 2, { terrain: 'ford', dungeon: 'Barrow' }), SIZE)).toEqual([]);
    expect(glyphsFor(cell(2, 2, { terrain: 'ford', grove: 'Grove' }), SIZE)).toEqual([]);
    // A road over a ford takes a bridge, so its stepping stones give way.
    expect(glyphsFor(cell(2, 2, { terrain: 'ford', road: true }), SIZE)).toEqual([]);
    // Glyphs set off-centre stay: a mountain hex loses its middle peak and keeps the other.
    expect(glyphsFor(cell(2, 2, { terrain: 'mountains' }), SIZE)).toHaveLength(2);
    expect(glyphsFor(cell(2, 2, { terrain: 'mountains', site: 'Keep' }), SIZE)).toHaveLength(1);
    // Impassable peaks crowd the hex, their middle one sitting off-centre too.
    expect(glyphsFor(cell(2, 2, { terrain: 'peaks' }), SIZE)).toHaveLength(3);
    expect(glyphsFor(cell(2, 2, { terrain: 'peaks', dungeon: 'Pit' }), SIZE)).toHaveLength(2);
  });
});

describe('roads and rivers', () => {
  it('curves a road through each hex from the edge it enters to the edge it leaves', () => {
    const cells = [
      cell(1, 1, { road: true }),
      cell(2, 1, { road: true }),
      cell(3, 1, { road: true }),
    ];
    const d = roadPath(cells);
    // The ends run from their centres to the shared edge; the middle hex curves through its centre.
    expect(segments(d)).toBe(3);
    const mid = cells[1] as HexCell;
    expect(d).toContain(`Q${mid.cx.toFixed(1)},${mid.cy.toFixed(1)} `);
  });

  it('runs each way straight to the centre at a crossroads', () => {
    const hub = cell(2, 2, { road: true });
    const ways = [
      cell(2, 1, { road: true }),
      cell(1, 2, { road: true }),
      cell(3, 2, { road: true }),
    ];
    const d = roadPath([hub, ...ways]);
    const centre = `M${hub.cx.toFixed(1)},${hub.cy.toFixed(1)}L`;
    expect(d.split(centre).length - 1).toBe(3);
    expect(d).not.toContain(`Q${hub.cx.toFixed(1)}`);
  });

  it('runs a road on into a town beside it, and dots a road hex with no road beside it', () => {
    const town = cell(2, 1, { site: 'Rubblegate' });
    expect(segments(roadPath([cell(1, 1, { road: true }), town]))).toBe(1);
    const lone = cell(5, 5, { road: true });
    expect(roadPath([lone])).toBe(`M${lone.cx.toFixed(1)},${lone.cy.toFixed(1)}h0.1`);
    expect(roadPath([cell(1, 1), cell(2, 1)])).toBe('');
  });

  it('joins rivers and fords, and lakes beside them, but not dry land', () => {
    const cells = [
      cell(1, 1, { terrain: 'river' }),
      cell(1, 2, { terrain: 'ford' }),
      cell(1, 3, { terrain: 'lake' }),
      cell(2, 1, { terrain: 'plains' }),
      cell(1, 0, { terrain: null }),
    ];
    // River: one link (to the ford); ford: two links (river and lake), one curve.
    expect(segments(riverPath(cells))).toBe(2);
  });
});

describe('the light of the hour', () => {
  it('warms the morning, leaves the day clear, reddens the evening, and darkens the night', () => {
    expect(dayTint(1).opacity).toBe(0);
    expect(dayTint(0).opacity).toBeGreaterThan(0);
    expect(dayTint(2).opacity).toBeGreaterThan(dayTint(0).opacity);
    expect(dayTint(3).opacity).toBeGreaterThan(dayTint(2).opacity);
  });
});

describe('the scale bar', () => {
  it('measures six-mile hexes, centre to centre, in alternating blocks', () => {
    const bar = scaleBar(400, SIZE);
    expect(HEX_MILES).toBe(6);
    expect(bar.label).toBe('30 miles');
    expect(bar.blocks).toHaveLength(5);
    expect(bar.blocks.map((b) => b.dark)).toEqual([true, false, true, false, true]);
    // Each block spans the distance between two neighbouring hex centres.
    const step = hexCenter({ col: 0, row: 1 }, SIZE).y - hexCenter({ col: 0, row: 0 }, SIZE).y;
    expect(bar.blocks[0]?.width).toBeCloseTo(step);
    expect(bar.blocks[1]?.x).toBeCloseTo(bar.x + step);
    expect(bar.y).toBeLessThan(400);
    expect(scaleBar(400, SIZE, 2).label).toBe('12 miles');
  });
});
