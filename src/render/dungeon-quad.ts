// Points and quads of the first-person view, the drawing helpers that lay lines and shapes out
// inside a quad's own perspective, and the hash that varies them (docs/presentation-plan.md, V1).
// A leaf module: dungeon-detail.ts and dungeon-relief.ts both draw with it.

export type Point = [number, number];
/** Top-left, top-right, bottom-right, bottom-left. */
export type Quad = [Point, Point, Point, Point];

export const mix = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];

/** A point inside a quad by its fractions across (u) and down (v). */
export const inQuad = (q: Quad, u: number, v: number): Point =>
  mix(mix(q[0], q[1], u), mix(q[3], q[2], u), v);

export const inset = (q: Quad, u0: number, u1: number, v0: number, v1: number): Quad => [
  inQuad(q, u0, v0),
  inQuad(q, u1, v0),
  inQuad(q, u1, v1),
  inQuad(q, u0, v1),
];

export const pt = ([x, y]: Point) => `${x.toFixed(1)},${y.toFixed(1)}`;
export const line = (q: Quad, u0: number, v0: number, u1: number, v1: number) =>
  `M${pt(inQuad(q, u0, v0))}L${pt(inQuad(q, u1, v1))}`;
export const shape = (q: Quad) => `M${pt(q[0])}L${pt(q[1])}L${pt(q[2])}L${pt(q[3])}Z`;

/** A stable number from 0 to 1 for a string: FNV-1a, then scaled. */
export function hash01(key: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return (h >>> 0) / 0x100000000;
}
