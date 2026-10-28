import { describe, expect, it } from 'vitest';
import { paperGrain } from '../../src/render/paper-grain.ts';

type Pt = [number, number];
const starts = (d: string): Pt[] =>
  [...d.matchAll(/M([\d.-]+),([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);
/** Each fibre's end, relative to its start. */
const reaches = (d: string): Pt[] =>
  [...d.matchAll(/q[\d.,-]+ ([\d.-]+),([\d.-]+)/g)].map((m) => [Number(m[1]), Number(m[2])]);

describe('paper grain', () => {
  it('lays the asked number of specks and fibres, the same every time', () => {
    const g = paperGrain(97, 90, 14);
    expect(g).toEqual(paperGrain(97, 90, 14));
    expect(g.tile).toBe(97);
    expect(starts(g.specks)).toHaveLength(90);
    expect(starts(g.fibres)).toHaveLength(14);
    const small = paperGrain(54);
    expect(small.specks).not.toBe(g.specks);
    expect(starts(small.specks)).toHaveLength(30);
    expect(starts(small.fibres)).toHaveLength(6);
  });

  it('keeps every speck and fibre a margin in from the seams', () => {
    const g = paperGrain(97, 200, 40);
    const margin = 97 * 0.08;
    for (const [x, y] of [...starts(g.specks), ...starts(g.fibres)]) {
      for (const v of [x, y]) {
        expect(v).toBeGreaterThanOrEqual(margin - 0.05);
        expect(v).toBeLessThanOrEqual(97 - margin + 0.05);
      }
    }
    // A fibre is never longer than the margin, so it can't cross a seam either.
    const ends = reaches(g.fibres);
    expect(ends).toHaveLength(40);
    for (const [dx, dy] of ends) expect(Math.hypot(dx, dy)).toBeLessThanOrEqual(margin + 0.1);
  });

  it('scatters specks over the whole tile, not along a line', () => {
    const pts = starts(paperGrain(100, 400).specks);
    // Every quarter of the tile gets a fair share.
    const quarters = [0, 0, 0, 0];
    for (const [x, y] of pts) {
      const q = (x < 50 ? 0 : 1) + (y < 50 ? 0 : 2);
      quarters[q] = (quarters[q] ?? 0) + 1;
    }
    for (const q of quarters) expect(q).toBeGreaterThan(60);
    // x and y are not tied to each other.
    const mean = (k: 0 | 1) => pts.reduce((s, p) => s + p[k], 0) / pts.length;
    const [mx, my] = [mean(0), mean(1)];
    const cov = pts.reduce((s, [x, y]) => s + (x - mx) * (y - my), 0) / pts.length;
    const sd = (k: 0 | 1, m: number) =>
      Math.sqrt(pts.reduce((s, p) => s + (p[k] - m) ** 2, 0) / pts.length);
    expect(Math.abs(cov / (sd(0, mx) * sd(1, my)))).toBeLessThan(0.15);
  });
});
