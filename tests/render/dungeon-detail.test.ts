import { describe, expect, it } from 'vitest';
import {
  beams,
  flagstones,
  hash01,
  inQuad,
  planks,
  stonework,
  treads,
  type Quad,
} from '../../src/render/dungeon-detail.ts';

const square: Quad = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];
/** A wall running away from the viewer: its far edge shorter than its near one. */
const receding: Quad = [
  [0, 0],
  [60, 30],
  [60, 70],
  [0, 100],
];
const segments = (d: string) => d.split('M').length - 1;
const shapes = (d: string) => (d.match(/Z/g) ?? []).length;

describe('dungeon surface detail', () => {
  it('hashes a key to a stable fraction', () => {
    expect(hash01('3,4:n')).toBe(hash01('3,4:n'));
    expect(hash01('3,4:n')).not.toBe(hash01('3,4:e'));
    for (const key of ['', 'a', '0,0:w', 'a long key for the hash']) {
      expect(hash01(key)).toBeGreaterThanOrEqual(0);
      expect(hash01(key)).toBeLessThan(1);
    }
  });

  it('finds points inside a quad by its fractions', () => {
    expect(inQuad(square, 0.5, 0.5)).toEqual([50, 50]);
    expect(inQuad(receding, 1, 0.5)).toEqual([60, 50]);
  });

  it('lays courses of stone with staggered joints, the same each time', () => {
    const a = stonework(square, '1,2:n');
    expect(a).toEqual(stonework(square, '1,2:n'));
    expect(a).not.toEqual(stonework(square, '1,2:s'));
    // Four mortar lines between five courses, and two or three joints in each course.
    const lines = segments(a.lines);
    expect(lines).toBeGreaterThanOrEqual(4 + 5 * 2);
    expect(lines).toBeLessThanOrEqual(4 + 5 * 3);
    expect(a.lines).toContain('M0.0,20.0L100.0,20.0');
    // Joints recede with the wall: none falls outside it.
    const xs = [...stonework(receding, 'x').lines.matchAll(/[ML](-?[\d.]+),/g)].map((m) =>
      Number(m[1]),
    );
    expect(Math.min(...xs)).toBeGreaterThanOrEqual(0);
    expect(Math.max(...xs)).toBeLessThanOrEqual(60);
  });

  it('darkens about one stone in six across many walls', () => {
    let patches = 0;
    let stones = 0;
    for (let i = 0; i < 200; i++) {
      const s = stonework(square, `${i},0:n`);
      patches += shapes(s.patches);
      stones += segments(s.lines) - 4 + 5;
    }
    expect(patches / stones).toBeGreaterThan(0.1);
    expect(patches / stones).toBeLessThan(0.25);
  });

  it('builds a door of three plank seams, two bands, and a ring', () => {
    const door = planks(square);
    expect(segments(door.lines)).toBe(3);
    expect(shapes(door.patches)).toBe(3);
  });

  it('flags a floor in four, darkening one stone some of the time', () => {
    const counts = [0, 0];
    for (let i = 0; i < 100; i++) {
      const f = flagstones(square, `${i},${i}`);
      expect(segments(f.lines)).toBe(3);
      counts[shapes(f.patches)] = (counts[shapes(f.patches)] as number) + 1;
    }
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(0);
  });

  it('draws stair treads and ceiling beams', () => {
    expect(treads(square)).toEqual({
      lines: 'M0.0,30.0L100.0,30.0M0.0,55.0L100.0,55.0M0.0,78.0L100.0,78.0',
      patches: '',
    });
    const b = beams(square);
    expect(segments(b.lines)).toBe(3);
    expect(shapes(b.patches)).toBe(1);
  });
});
