import { describe, expect, it } from 'vitest';
import {
  beams,
  breach,
  courses,
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

  it('builds a door of three plank seams, two bands, a ring, and grain down each plank', () => {
    const door = planks(square, '2,2:e');
    expect(segments(door.lines)).toBe(3);
    expect(shapes(door.patches)).toBe(3);
    expect(segments(door.relief?.cracks ?? '')).toBe(8);
    expect(door).toEqual(planks(square, '2,2:e'));
    expect(door.relief?.cracks).not.toBe(planks(square, '2,2:w').relief?.cracks);
  });

  it('keeps the same mortar and dark stones as before relief, with relief for every stone', () => {
    const wall = stonework(square, '4,4:n');
    const { stones } = courses('4,4:n');
    expect(shapes(wall.relief?.bevels ?? '')).toBe(stones.length);
    expect(wall.relief?.grime).toHaveLength(3);
    // The stones tile the wall: each course runs edge to edge.
    for (let row = 0; row < 5; row++) {
      const course = stones.filter((s) => s.v0 === row / 5);
      expect(course[0]?.u0).toBe(0);
      expect(course.at(-1)?.u1).toBe(1);
    }
  });

  it('flags a floor in four, darkening one stone some of the time', () => {
    const counts = [0, 0];
    for (let i = 0; i < 100; i++) {
      const f = flagstones(square, `${i},${i}`);
      expect(segments(f.lines)).toBe(3);
      expect(shapes(f.relief?.bevels ?? '')).toBe(4);
      expect(f.relief?.grime).toEqual([]);
      counts[shapes(f.patches)] = (counts[shapes(f.patches)] as number) + 1;
    }
    expect(counts[0]).toBeGreaterThan(0);
    expect(counts[1]).toBeGreaterThan(0);
  });

  it('draws stair treads and ceiling beams', () => {
    const stair = treads(square, '6,1');
    expect(stair.lines).toBe('M0.0,30.0L100.0,30.0M0.0,55.0L100.0,55.0M0.0,78.0L100.0,78.0');
    expect(stair.patches).toBe('');
    // Four treads, each with its nosing lit and its foot in shadow.
    expect(shapes(stair.relief?.bevels ?? '')).toBe(4);
    expect(shapes(stair.relief?.undersides ?? '')).toBe(4);
    expect(stair.relief?.cracks).toBe('');
    const b = beams(square);
    expect(segments(b.lines)).toBe(3);
    expect(shapes(b.patches)).toBe(1);
  });

  it('tears a ragged hole through a wall, open to the floor, the same from either side', () => {
    const hole = breach(square, '8,8,w');
    expect(hole).toEqual(breach(square, '8,8,w'));
    expect(hole.rim).not.toBe(breach(square, '5,8,n').rim);
    // The wall's outline then the hole, for an even-odd clip.
    expect(hole.clip.startsWith('M0.0,0.0L100.0,0.0L100.0,100.0L0.0,100.0Z')).toBe(true);
    expect(hole.clip.endsWith(hole.rim)).toBe(true);
    const ys = [...hole.rim.matchAll(/[ML][\d.]+,([\d.]+)/g)].map((m) => Number(m[1]));
    // It reaches the floor so the party can walk it, and stops short of the ceiling.
    expect(Math.max(...ys)).toBe(100);
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(10);
    expect(shapes(hole.rubble)).toBe(5);
  });
});
