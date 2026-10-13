// Procedural surface detail for the first-person view (docs/presentation-plan.md, V1): coursed
// stone, door planks and bands, flagstones, and stair treads. Every line is laid out inside the
// panel's own perspective quad, so it recedes with the wall. Variation comes from a hash of the
// cell and face, not from the RNG: it is drawing, not chance, and a wall must look the same on
// every visit.

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

const pt = ([x, y]: Point) => `${x.toFixed(1)},${y.toFixed(1)}`;
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

/** Lines to stroke over a panel, and darker patches to fill. */
export interface Detail {
  lines: string;
  patches: string;
}

const COURSES = 5;
const STONES = 3;

/**
 * Coursed stone: mortar lines between courses, joints staggered course to course and nudged by
 * the hash, and about one stone in six a shade darker.
 */
export function stonework(q: Quad, key: string): Detail {
  const lines: string[] = [];
  const patches: string[] = [];
  for (let row = 0; row < COURSES; row++) {
    const [v0, v1] = [row / COURSES, (row + 1) / COURSES];
    if (row > 0) lines.push(line(q, 0, v0, 1, v0));
    const stagger = (row % 2) * 0.5 + (hash01(`${key}:${row}`) - 0.5) * 0.3;
    const joints: number[] = [];
    for (let j = 0; j <= STONES; j++) {
      const u = (j + stagger) / STONES;
      if (u > 0.04 && u < 0.96) joints.push(u);
    }
    for (const u of joints) lines.push(line(q, u, v0, u, v1));
    const edges = [0, ...joints, 1];
    for (let s = 0; s + 1 < edges.length; s++) {
      if (hash01(`${key}:${row}:${s}`) < 0.17)
        patches.push(shape(inset(q, edges[s] as number, edges[s + 1] as number, v0, v1)));
    }
  }
  return { lines: lines.join(''), patches: patches.join('') };
}

/** A door leaf: upright planks, two iron bands, and a ring. */
export function planks(q: Quad): Detail {
  const lines = [0.25, 0.5, 0.75].map((u) => line(q, u, 0, u, 1));
  const bands = [0.18, 0.72].map((v) => shape(inset(q, 0.04, 0.96, v, v + 0.07)));
  const ring = shape(inset(q, 0.62, 0.72, 0.46, 0.56));
  return { lines: lines.join(''), patches: [...bands, ring].join('') };
}

/** A floor square as four flagstones, the cross nudged by the hash, one stone sometimes darker. */
export function flagstones(q: Quad, key: string): Detail {
  const u = 0.5 + (hash01(`${key}:u`) - 0.5) * 0.3;
  const v = 0.5 + (hash01(`${key}:v`) - 0.5) * 0.3;
  const lines = [line(q, 0, 0, 1, 0), line(q, u, 0, u, 1), line(q, 0, v, 1, v)];
  const pick = hash01(`${key}:dark`);
  const patches =
    pick < 0.25 ? [shape(inset(q, 0, u, 0, v))] : pick < 0.4 ? [shape(inset(q, u, 1, v, 1))] : [];
  return { lines: lines.join(''), patches: patches.join('') };
}

/** Treads across a stairway, nearer ones further apart. */
export function treads(q: Quad): Detail {
  const lines = [0.3, 0.55, 0.78].map((v) => line(q, 0, v, 1, v));
  return { lines: lines.join(''), patches: '' };
}

/** A ceiling square: a cross-beam at its far edge and two joists running away. */
export function beams(q: Quad): Detail {
  const lines = [line(q, 0, 0, 1, 0), line(q, 0.33, 0, 0.33, 1), line(q, 0.67, 0, 0.67, 1)];
  const patches = [shape(inset(q, 0, 1, 0, 0.12))];
  return { lines: lines.join(''), patches: patches.join('') };
}

/** A wall magic has torn through: the stone left standing, the hole's broken rim, and rubble. */
export interface Breach {
  /** The wall's outline and the hole together, to clip the wall with the even-odd rule. */
  clip: string;
  rim: string;
  rubble: string;
}

/**
 * A ragged hole through a wall, open to the floor so the party can walk it, its edge jagged by the
 * hash of the edge so both sides of the wall show the same hole.
 */
export function breach(q: Quad, key: string): Breach {
  const sides = 22;
  const hole = Array.from({ length: sides }, (_, i) => {
    const a = (2 * Math.PI * i) / sides;
    // Alternate bites in and out, so the edge breaks like stone rather than curving.
    const k = (i % 2 ? 0.9 : 1) + (hash01(`${key}:${i}`) - 0.5) * 0.24;
    const u = Math.min(0.94, Math.max(0.06, 0.5 + 0.36 * k * Math.cos(a)));
    const v = Math.min(1, Math.max(0.1, 0.62 + 0.46 * k * Math.sin(a)));
    return inQuad(q, u, v);
  });
  const ring = `M${hole.map(pt).join('L')}Z`;
  // Broken stone heaped low at the foot of the hole, spilling a little past the wall's base.
  const rubble = [0.28, 0.4, 0.52, 0.63, 0.74].map((u, i) => {
    const w = 0.045 + hash01(`${key}:r${i}`) * 0.03;
    const h = 0.012 + hash01(`${key}:h${i}`) * 0.012;
    const v = 1 + (hash01(`${key}:v${i}`) - 0.3) * 0.04;
    const corners: [number, number][] = [
      [u - w, v],
      [u - w * 0.4, v - h],
      [u + w * 0.5, v - h * 0.8],
      [u + w, v],
      [u + w * 0.2, v + h * 0.4],
    ];
    return `M${corners.map(([x, y]) => pt(inQuad(q, x, y))).join('L')}Z`;
  });
  return { clip: shape(q) + ring, rim: ring, rubble: rubble.join('') };
}
