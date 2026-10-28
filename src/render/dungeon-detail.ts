// Procedural surface detail for the first-person view (docs/presentation-plan.md, V1): coursed
// stone, door planks and bands, flagstones, and stair treads. Every line is laid out inside the
// panel's own perspective quad, so it recedes with the wall. Variation comes from a hash of the
// cell and face, not from the RNG: it is drawing, not chance, and a wall must look the same on
// every visit.

import { hash01, inQuad, inset, line, pt, shape, type Quad } from './dungeon-quad.ts';
import { DARK_STONE, grain, NO_RELIEF, relief, type Relief, type Stone } from './dungeon-relief.ts';

export { hash01, inQuad, inset, line, mix, shape, type Point, type Quad } from './dungeon-quad.ts';

/** Lines to stroke over a panel, and darker patches to fill. */
export interface Detail {
  lines: string;
  patches: string;
  /** Bevels, undersides, cracks, and grime that give the surface depth (dungeon-relief.ts). */
  relief?: Relief;
}

const COURSES = 5;
const STONES = 3;

/** The stones of a coursed wall: joints staggered course to course and nudged by the hash. */
export function courses(key: string): { stones: Stone[]; joints: number[][] } {
  const stones: Stone[] = [];
  const joints: number[][] = [];
  for (let row = 0; row < COURSES; row++) {
    const [v0, v1] = [row / COURSES, (row + 1) / COURSES];
    const stagger = (row % 2) * 0.5 + (hash01(`${key}:${row}`) - 0.5) * 0.3;
    const js: number[] = [];
    for (let j = 0; j <= STONES; j++) {
      const u = (j + stagger) / STONES;
      if (u > 0.04 && u < 0.96) js.push(u);
    }
    joints.push(js);
    const edges = [0, ...js, 1];
    for (let s = 0; s + 1 < edges.length; s++)
      stones.push({
        u0: edges[s] as number,
        u1: edges[s + 1] as number,
        v0,
        v1,
        key: `${key}:${row}:${s}`,
      });
  }
  return { stones, joints };
}

/**
 * Coursed stone: mortar lines between courses, joints staggered course to course, and about one
 * stone in six a shade darker, raised in relief with a lit top, a shadowed foot, and grime where
 * the wall meets the floor.
 */
export function stonework(q: Quad, key: string): Detail {
  const { stones, joints } = courses(key);
  const lines: string[] = [];
  joints.forEach((js, row) => {
    const [v0, v1] = [row / COURSES, (row + 1) / COURSES];
    if (row > 0) lines.push(line(q, 0, v0, 1, v0));
    for (const u of js) lines.push(line(q, u, v0, u, v1));
  });
  const patches = stones
    .filter((s) => hash01(s.key) < DARK_STONE)
    .map((s) => shape(inset(q, s.u0, s.u1, s.v0, s.v1)));
  return {
    lines: lines.join(''),
    patches: patches.join(''),
    relief: relief(q, stones, { lit: 'top', grime: true, cracks: true }),
  };
}

/** A door leaf: upright planks with their grain, two iron bands, and a ring. */
export function planks(q: Quad, key: string): Detail {
  const lines = [0.25, 0.5, 0.75].map((u) => line(q, u, 0, u, 1));
  const bands = [0.18, 0.72].map((v) => shape(inset(q, 0.04, 0.96, v, v + 0.07)));
  const ring = shape(inset(q, 0.62, 0.72, 0.46, 0.56));
  const boards = [0, 1, 2, 3].map((i) => ({
    u0: i / 4,
    u1: (i + 1) / 4,
    v0: 0,
    v1: 1,
    key: `${key}:p${i}`,
  }));
  return {
    lines: lines.join(''),
    patches: [...bands, ring].join(''),
    relief: { ...NO_RELIEF, cracks: grain(q, boards) },
  };
}

/**
 * A floor square as four flagstones, the cross nudged by the hash, one stone sometimes darker,
 * each lit along its near edge with the gap beyond it in shadow.
 */
export function flagstones(q: Quad, key: string): Detail {
  const u = 0.5 + (hash01(`${key}:u`) - 0.5) * 0.3;
  const v = 0.5 + (hash01(`${key}:v`) - 0.5) * 0.3;
  const lines = [line(q, 0, 0, 1, 0), line(q, u, 0, u, 1), line(q, 0, v, 1, v)];
  const pick = hash01(`${key}:dark`);
  const patches =
    pick < 0.25 ? [shape(inset(q, 0, u, 0, v))] : pick < 0.4 ? [shape(inset(q, u, 1, v, 1))] : [];
  const flags: Stone[] = [
    [0, u, 0, v],
    [u, 1, 0, v],
    [0, u, v, 1],
    [u, 1, v, 1],
  ].map(([u0, u1, v0, v1], i) => ({
    u0: u0 as number,
    u1: u1 as number,
    v0: v0 as number,
    v1: v1 as number,
    key: `${key}:f${i}`,
  }));
  return {
    lines: lines.join(''),
    patches: patches.join(''),
    relief: relief(q, flags, { lit: 'near', grime: false, cracks: true }),
  };
}

const TREADS = [0, 0.3, 0.55, 0.78, 1];

/** Treads across a stairway, nearer ones further apart, each lit along its nosing. */
export function treads(q: Quad, key: string): Detail {
  const lines = TREADS.slice(1, -1).map((v) => line(q, 0, v, 1, v));
  const steps = TREADS.slice(1).map((v1, i) => ({
    u0: 0,
    u1: 1,
    v0: TREADS[i] as number,
    v1,
    key: `${key}:t${i}`,
  }));
  return {
    lines: lines.join(''),
    patches: '',
    relief: relief(q, steps, { lit: 'top', grime: false, cracks: false }),
  };
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
