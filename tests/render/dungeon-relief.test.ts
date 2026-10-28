import { describe, expect, it } from 'vitest';
import type { Quad } from '../../src/render/dungeon-quad.ts';
import {
  CRACKED,
  GRIME,
  grain,
  LIGHT_STONE,
  relief,
  type Stone,
} from '../../src/render/dungeon-relief.ts';

const square: Quad = [
  [0, 0],
  [100, 0],
  [100, 100],
  [0, 100],
];
const shapes = (d: string) => (d.match(/Z/g) ?? []).length;
const segments = (d: string) => d.split('M').length - 1;
const ys = (d: string) => [...d.matchAll(/[ML][\d.-]+,([\d.-]+)/g)].map((m) => Number(m[1]));
const xs = (d: string) => [...d.matchAll(/[ML]([\d.-]+),/g)].map((m) => Number(m[1]));
const one = (key: string): Stone => ({ u0: 0, u1: 1, v0: 0, v1: 1, key });

describe('surface relief', () => {
  it('lights a wall stone along its top and shadows its foot', () => {
    const r = relief(square, [one('a')], { lit: 'top', grime: false, cracks: true });
    expect(Math.max(...ys(r.bevels))).toBeLessThan(25);
    expect(Math.min(...ys(r.undersides))).toBeGreaterThan(75);
    // The bevel stops short of the stone's sides, so the joint stays dark.
    expect(Math.min(...xs(r.bevels))).toBeGreaterThan(0);
    expect(Math.max(...xs(r.bevels))).toBeLessThan(100);
  });

  it('lights a flagstone along its near edge and shadows the gap beyond it', () => {
    const r = relief(square, [one('a')], { lit: 'near', grime: false, cracks: true });
    expect(Math.min(...ys(r.bevels))).toBeGreaterThan(75);
    expect(Math.max(...ys(r.undersides))).toBeLessThan(25);
  });

  it('lays grime in bands up from the foot of a wall, and none without it', () => {
    const r = relief(square, [one('a')], { lit: 'top', grime: true, cracks: true });
    expect(r.grime).toHaveLength(GRIME.length);
    r.grime.forEach((d, i) => {
      expect(Math.min(...ys(d))).toBeCloseTo(100 * (GRIME[i] as number), 0);
      expect(Math.max(...ys(d))).toBe(100);
    });
    expect(relief(square, [one('a')], { lit: 'top', grime: false, cracks: true }).grime).toEqual(
      [],
    );
  });

  it('lightens about one stone in seven and cracks about one in eight, the same each time', () => {
    const stones = Array.from({ length: 400 }, (_, i) => one(`${i},0:n:0:0`));
    const r = relief(square, stones, { lit: 'top', grime: false, cracks: true });
    expect(r).toEqual(relief(square, stones, { lit: 'top', grime: false, cracks: true }));
    expect(shapes(r.bevels)).toBe(400);
    expect(shapes(r.undersides)).toBe(400);
    expect(shapes(r.lights) / 400).toBeGreaterThan(LIGHT_STONE - 0.06);
    expect(shapes(r.lights) / 400).toBeLessThan(LIGHT_STONE + 0.06);
    expect(segments(r.cracks) / 400).toBeGreaterThan(CRACKED - 0.05);
    expect(segments(r.cracks) / 400).toBeLessThan(CRACKED + 0.05);
  });

  it('keeps a crack inside its stone, running down from the top', () => {
    const stones = Array.from({ length: 400 }, (_, i) => ({
      u0: 0.2,
      u1: 0.6,
      v0: 0.4,
      v1: 0.6,
      key: `s${i}`,
    }));
    const { cracks } = relief(square, stones, { lit: 'top', grime: false, cracks: true });
    expect(cracks).not.toBe('');
    for (const d of cracks.split('M').slice(1)) {
      const y = ys(`M${d}`);
      expect(y[0]).toBeCloseTo(40, 5);
      expect(Math.max(...y)).toBeLessThanOrEqual(60);
      const x = xs(`M${d}`);
      expect(Math.min(...x)).toBeGreaterThan(20);
      expect(Math.max(...x)).toBeLessThan(60);
    }
  });

  it('cracks nothing when asked not to', () => {
    const stones = Array.from({ length: 100 }, (_, i) => one(`t${i}`));
    const r = relief(square, stones, { lit: 'top', grime: false, cracks: false });
    expect(r.cracks).toBe('');
    expect(shapes(r.bevels)).toBe(100);
  });

  it('runs two grain lines the length of each plank, inside it', () => {
    const planks = [0, 1].map((i) => ({ u0: i / 2, u1: (i + 1) / 2, v0: 0, v1: 1, key: `p${i}` }));
    const g = grain(square, planks);
    expect(segments(g)).toBe(4);
    expect(g).toBe(grain(square, planks));
    const lines = g.split('M').slice(1);
    for (const [i, d] of lines.entries()) {
      const y = ys(`M${d}`);
      expect(y[0]).toBe(0);
      expect(y.at(-1)).toBe(100);
      const x = xs(`M${d}`);
      const plank = i < 2 ? [0, 50] : [50, 100];
      expect(Math.min(...x)).toBeGreaterThan(plank[0] as number);
      expect(Math.max(...x)).toBeLessThan(plank[1] as number);
    }
  });
});
