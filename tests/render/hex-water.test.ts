import { describe, expect, it } from 'vitest';
import { hexCenter, hexPoints, type HexCell } from '../../src/render/hex-view.ts';
import { bridges, shores } from '../../src/render/hex-water.ts';

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
    ...over,
  };
}
const segments = (d: string) => d.split('M').length - 1;

describe('shorelines', () => {
  it('draws one edge for each side a lake shares with known dry land', () => {
    // A lake ringed by its six neighbours: four dry, one more water, one under fog.
    const lake = cell(2, 2, { terrain: 'lake' });
    const ring = [
      cell(3, 1),
      cell(3, 2, { terrain: 'river' }),
      cell(2, 3),
      cell(1, 2, { terrain: null }),
      cell(1, 1, { terrain: 'forest' }),
      cell(2, 1),
    ];
    const { line, shallows } = shores([lake, ...ring], SIZE);
    // Four dry sides of the lake, and the two the river shares with the dry hexes either side of it.
    expect(segments(line)).toBe(6);
    expect(segments(shallows)).toBe(6);
    expect(segments(shores([lake, ...ring.slice(2)], SIZE).line)).toBe(3);
  });

  it('lays the shore on the shared edge, the shallows just inside the water', () => {
    const lake = cell(0, 0, { terrain: 'lake' });
    const land = cell(0, 1);
    const { line, shallows } = shores([lake, land], SIZE);
    // The edge below a flat-topped hex runs between its two lower corners.
    const y = (lake.cy + (SIZE * Math.sqrt(3)) / 2).toFixed(1);
    expect(line).toBe(
      `M${(lake.cx + SIZE / 2).toFixed(1)},${y}L${(lake.cx - SIZE / 2).toFixed(1)},${y}`,
    );
    const [, inY] = (shallows.match(/M[\d.]+,([\d.]+)/) as RegExpMatchArray).map(Number);
    expect(inY).toBeLessThan(Number(y));
    expect(shores([cell(0, 0), cell(0, 1)], SIZE)).toEqual({ line: '', shallows: '' });
  });
});

describe('bridges', () => {
  it('lays a bridge along the road over a ford, river, or nothing to join', () => {
    // A road running north and south over a ford.
    const ford = cell(2, 2, { terrain: 'ford', road: true });
    const across = bridges([cell(2, 1, { road: true }), ford, cell(2, 3, { road: true })]);
    expect(across).toEqual([{ key: '2,2', x: ford.cx, y: ford.cy, angle: 90 }]);
    // A road that ends at the river, toward a town to the south.
    const end = bridges([
      cell(2, 2, { terrain: 'river', road: true }),
      cell(2, 3, { site: 'Ford' }),
    ]);
    expect(end[0]?.angle).toBe(90);
    expect(bridges([cell(4, 4, { terrain: 'river', road: true })])[0]?.angle).toBe(0);
    // A road running east to west lies within a half turn, whichever way it is read.
    const ew = bridges([cell(3, 2, { road: true }), ford, cell(1, 2, { road: true })]);
    expect(Math.abs(ew[0]?.angle as number)).toBeLessThanOrEqual(90);
  });

  it('builds no bridge on dry road or on water with no road', () => {
    expect(bridges([cell(1, 1, { road: true }), cell(2, 2, { terrain: 'lake' })])).toEqual([]);
    expect(bridges([cell(1, 1, { terrain: 'river' })])).toEqual([]);
  });
});
