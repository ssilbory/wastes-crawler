import { describe, expect, it } from 'vitest';
import { regionMap } from '../../src/game/world/region.ts';
import {
  hexCells,
  hexCenter,
  hexPoints,
  hexReport,
  mapPixels,
  type HexCell,
} from '../../src/render/hex-view.ts';
import { data, world } from '../game/world/helpers.ts';

describe('hex map view', () => {
  const map = regionMap(data, 'borderlands');

  it('lays out flat-topped hexes with odd columns shifted down', () => {
    expect(hexCenter({ col: 0, row: 0 }, 10)).toEqual({ x: 10, y: 5 * Math.sqrt(3) });
    expect(hexCenter({ col: 1, row: 0 }, 10).y).toBeCloseTo(10 * Math.sqrt(3));
    expect(hexPoints({ col: 0, row: 0 }, 10).split(' ')[0]).toBe('20.0,8.7');
    expect(mapPixels(map, 10)).toEqual({ width: 365, height: 321 });
  });

  it('shows known terrain, sites, roads, the party, and the route under fog', () => {
    const w = world();
    w.destination = { col: 4, row: 8 };
    const cells = hexCells(map, w, [{ col: 4, row: 8 }], 10);
    expect(cells).toHaveLength(24 * 18);
    const at = (key: string) => cells.find((c) => c.key === key);
    expect(at('3,8')).toMatchObject({
      terrain: 'plains',
      label: 'Rubblegate (3,8)',
      site: 'Rubblegate',
      party: true,
      visited: true,
      road: true,
    });
    expect(at('4,8')).toMatchObject({ destination: true, route: true, visited: false });
    expect(at('3,7')).toMatchObject({ label: 'Plains (3,7)', road: false, site: null });
    expect(at('20,8')).toMatchObject({
      terrain: null,
      label: 'Unexplored (20,8)',
      site: null,
      road: false,
    });
    w.destination = null;
    expect(hexCells(map, w, [], 10).some((c) => c.destination)).toBe(false);
  });

  it('marks dungeon entrances once the hex is known', () => {
    const w = world();
    const ways = [
      { col: 3, row: 7, name: 'The Old Barrow' },
      { col: 20, row: 8, name: 'Hidden' },
    ];
    const cells = hexCells(map, w, [], 10, [], ways);
    expect(cells.find((c) => c.key === '3,7')?.dungeon).toBe('The Old Barrow');
    expect(cells.find((c) => c.key === '20,8')?.dungeon).toBeNull();
    expect(cells.find((c) => c.key === '3,8')?.dungeon).toBeNull();
  });

  it('reports what the party knows of a picked hex', () => {
    const w = world();
    const ways = [
      { col: 3, row: 8, name: 'The Old Barrow' },
      { col: 20, row: 8, name: 'Rumored Pit', heard: true },
    ];
    const cells = hexCells(map, w, [], 10, [], ways, [{ col: 3, row: 7, name: 'Ashgrove' }]);
    const report = (key: string) => hexReport(map, cells.find((c) => c.key === key) as HexCell);
    expect(report('3,8')).toBe('Plains (3,8). Town: Rubblegate. Dungeon: The Old Barrow.');
    expect(report('3,7')).toBe('Plains (3,7). Grove: Ashgrove.');
    expect(report('20,8')).toBe('Unexplored (20,8). Dungeon: Rumored Pit.');
    expect(report('21,8')).toBe('Unexplored (21,8).');
    const exit = map.exits[0] as { col: number; row: number; name: string };
    const out = hexCells(map, w, [], 10, [], [], [], [exit]).find(
      (c) => c.col === exit.col && c.row === exit.row,
    ) as HexCell;
    expect(hexReport(map, out)).toContain(`Road out: ${exit.name}.`);
  });
});
