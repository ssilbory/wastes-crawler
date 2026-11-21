import { describe, expect, it } from 'vitest';
import {
  compose,
  IDENTITY,
  parseTransform,
  scale,
  translate,
} from '../../../src/render/pixel/affine.ts';
import { invert, project, squareToQuad } from '../../../src/render/pixel/homography.ts';
import {
  bayer,
  glows,
  hex,
  hsl,
  MAT,
  palette,
  ramp,
  SHADES,
  step,
} from '../../../src/render/pixel/palette.ts';
import {
  CLEAR,
  grid,
  levelOf,
  matOf,
  noise,
  seedOf,
  TEXELS,
  texel,
} from '../../../src/render/pixel/texel.ts';
import type { Quad } from '../../../src/render/dungeon-quad.ts';

const close = (a: [number, number], b: [number, number]) => {
  expect(a[0]).toBeCloseTo(b[0], 6);
  expect(a[1]).toBeCloseTo(b[1], 6);
};

describe('pixel palette (docs/presentation-plan.md, V8)', () => {
  it('converts colours', () => {
    expect(hsl(0, 1, 0.5)).toEqual([255, 0, 0]);
    expect(hsl(120, 1, 0.5)).toEqual([0, 255, 0]);
    expect(hsl(0, 0, 1)).toEqual([255, 255, 255]);
    expect(hex('#ff8a2a')).toEqual([255, 138, 42]);
  });

  it('builds eight shades from a shared near-black, warmed by the light', () => {
    const stone = ramp(MAT.stone, '#ffffff');
    expect(stone).toHaveLength(SHADES);
    const sum = (c: number[]) => c.reduce((a, b) => a + b, 0);
    for (let i = 1; i < SHADES; i++)
      expect(sum(stone[i] as number[])).toBeGreaterThan(sum(stone[i - 1] as number[]));
    // Every ramp starts near black.
    for (const r of palette('#ff8a2a')) expect(sum(r[0] as number[])).toBeLessThan(60);
    // A torch warms the top of the ramp; cold sight cools it.
    const [tr, , tb] = ramp(MAT.stone, '#ff8a2a')[SHADES - 1] as number[];
    const [sr, , sb] = ramp(MAT.stone, '#7f93b0')[SHADES - 1] as number[];
    expect((tr as number) - (tb as number)).toBeGreaterThan((sr as number) - (sb as number));
    // Shadows lean toward violet: the second shade carries more blue against its green than the
    // brightest does.
    const [, g1, b1] = stone[1] as number[];
    const [, g7, b7] = stone[SHADES - 1] as number[];
    expect((b1 as number) / (g1 as number)).toBeGreaterThan((b7 as number) / (g7 as number));
    // Fire keeps its own colour whatever the light, and a black tint can't divide by zero.
    expect(ramp(MAT.flame, '#7f93b0')).toEqual(ramp(MAT.flame, '#ff8a2a'));
    expect(ramp(MAT.stone, '#000000').flat().every(Number.isFinite)).toBe(true);
    expect(glows(MAT.flame)).toBe(true);
    expect(glows(MAT.darkness)).toBe(true);
    expect(glows(MAT.stone)).toBe(false);
  });

  it('dithers a brightness between two steps in a fixed crosshatch', () => {
    const seen = new Set<number>();
    for (let y = 0; y < 4; y++) for (let x = 0; x < 4; x++) seen.add(bayer(x, y));
    expect(seen.size).toBe(16);
    expect(Math.min(...seen)).toBeGreaterThan(0);
    expect(Math.max(...seen)).toBeLessThan(1);
    expect(bayer(5, 6)).toBe(bayer(1, 2));
    expect(step(0, 3, 3)).toBe(0);
    expect(step(1, 0, 0)).toBe(SHADES - 1);
    expect(step(-1, 0, 0)).toBe(0);
    expect(step(2, 3, 3)).toBe(SHADES - 1);
    // Halfway between two steps, half the pixels take each.
    const v = 3.5 / (SHADES - 1);
    const steps = [0, 1, 2, 3].flatMap((y) => [0, 1, 2, 3].map((x) => step(v, x, y)));
    expect(steps.filter((s) => s === 3)).toHaveLength(8);
    expect(steps.filter((s) => s === 4)).toHaveLength(8);
  });
});

describe('perspective mapping', () => {
  const trapezoid: Quad = [
    [100, 50],
    [220, 70],
    [220, 170],
    [100, 190],
  ];

  it('maps the unit square onto a quad and back', () => {
    const m = squareToQuad(trapezoid);
    const out: [number, number] = [0, 0];
    const corners: [number, number][] = [
      [0, 0],
      [1, 0],
      [1, 1],
      [0, 1],
    ];
    corners.forEach(([u, v], i) => {
      project(m, u, v, out);
      close(out, trapezoid[i] as [number, number]);
    });
    const inv = invert(m);
    expect(inv).not.toBeNull();
    project(inv as NonNullable<typeof inv>, 220, 170, out);
    close(out, [1, 1]);
    // Perspective: the middle of the square is not the middle of the quad's edges.
    project(m, 0.5, 0.5, out);
    expect(out[0]).toBeGreaterThan(160);
  });

  it('handles a parallelogram without perspective, and refuses a flattened quad', () => {
    const square: Quad = [
      [0, 0],
      [10, 0],
      [10, 10],
      [0, 10],
    ];
    const m = squareToQuad(square);
    expect(m.slice(6)).toEqual([0, 0, 1]);
    const out: [number, number] = [0, 0];
    project(m, 0.5, 0.25, out);
    close(out, [5, 2.5]);
    expect(
      invert(
        squareToQuad([
          [0, 0],
          [10, 0],
          [20, 0],
          [5, 0],
        ]),
      ),
    ).toBeNull();
  });
});

describe('transforms', () => {
  it('reads SVG transform lists', () => {
    expect(parseTransform('')).toEqual(IDENTITY);
    expect(parseTransform('translate(3,4) scale(2)')).toEqual([2, 0, 0, 2, 3, 4]);
    expect(parseTransform('translate(5) scale(2,3)')).toEqual([2, 0, 0, 3, 5, 0]);
    expect(parseTransform('matrix(1 2 3 4 5 6)')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(parseTransform('matrix(1)')).toEqual([1, 0, 0, 1, 0, 0]);
    expect(parseTransform('skewX(10)')).toEqual(IDENTITY);
    const r = parseTransform('rotate(90,24,24)');
    // (24, 0) turns about the middle to (48, 24).
    expect(r[0] * 24 + r[2] * 0 + r[4]).toBeCloseTo(48);
    expect(r[1] * 24 + r[3] * 0 + r[5]).toBeCloseTo(24);
    const plain = parseTransform('rotate(180)');
    expect(plain[0]).toBeCloseTo(-1);
    expect(plain[4]).toBeCloseTo(0);
    expect(compose(translate(1, 2), scale(3))).toEqual([3, 0, 0, 3, 1, 2]);
  });
});

describe('texels', () => {
  it('packs a material and a brightness into one number', () => {
    const t = texel(MAT.wood, 0.5);
    expect(matOf(t)).toBe(MAT.wood);
    expect(levelOf(t)).toBeCloseTo(0.5, 2);
    expect(levelOf(texel(MAT.stone, 2))).toBe(1);
    expect(levelOf(texel(MAT.stone, -1))).toBe(0);
    expect(CLEAR).toBeLessThan(0);
  });

  it('hashes stably, and lays fractions on the grid', () => {
    expect(noise(1, 2, 3, 4)).toBe(noise(1, 2, 3, 4));
    expect(noise(1, 2, 3, 4)).not.toBe(noise(1, 2, 3, 5));
    expect(noise(seedOf('a'), 1)).toBeGreaterThanOrEqual(0);
    expect(noise(seedOf('a'), 1)).toBeLessThan(1);
    expect(grid(0)).toBe(0);
    expect(grid(1)).toBe(TEXELS - 1);
    expect(grid(-0.2)).toBe(0);
    expect(grid(0.5)).toBe(TEXELS / 2);
  });
});
