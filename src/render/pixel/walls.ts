// Pixel textures for upright faces (docs/presentation-plan.md, V8): coursed stone with bevelled,
// cracked, and mossy blocks and grime up from the foot; a door's plank leaf with its iron bands,
// studs, and ring in a timber frame; and a wall torn open by magic, its hole ragged and rubble at
// its foot. Each takes the texel's fractions across (u) and down (v) and the panel's seed.
import { MAT } from './palette.ts';
import { CLEAR, grid, noise, TEXELS, texel } from './texel.ts';

/** Texel rows per course of stone, and columns per block. */
const COURSE = 8;
const BLOCK = 16;

/** A texel of coursed stone. */
export function stone(u: number, v: number, seed: number): number {
  const tu = grid(u);
  const tv = grid(v);
  const row = Math.floor(tv / COURSE);
  // Each course is offset from the last, by half a block give or take.
  const shift = (row % 2) * (BLOCK / 2) + Math.floor(noise(seed, row, 7) * 4);
  const x = tu + shift;
  const col = Math.floor(x / BLOCK);
  const lx = x % BLOCK;
  const ly = tv % COURSE;
  if (lx === 0 || ly === 0) return texel(MAT.mortar, 0.5 + noise(seed, tu, tv, 3) * 0.12);
  const block = noise(seed, col, row);
  let level = 0.58 + (block - 0.5) * 0.24 + (noise(seed, tu, tv) - 0.5) * 0.09;
  // Lit along the top and the left, in shadow along the foot and the right.
  if (ly === 1) level += 0.2;
  else if (ly === COURSE - 1) level -= 0.16;
  if (lx === 1) level += 0.08;
  else if (lx === BLOCK - 1) level -= 0.1;
  // About one block in eight is cracked, corner to corner.
  if (block < 0.12) {
    const along = 3 + ly * 1.4 + noise(seed, col, row, 5) * 5;
    if (Math.abs(lx - along) < 0.7) level -= 0.32;
  }
  // Grime rises from the foot, and moss creeps over some of the lowest blocks.
  const foot = Math.max(0, (tv - TEXELS * 0.62) / (TEXELS * 0.38));
  level -= foot * 0.2;
  if (foot > 0.25 && noise(seed, col, row, 9) < 0.3 && noise(seed, tu, tv, 11) < foot * 0.8)
    return texel(MAT.moss, level + 0.05);
  return texel(MAT.stone, level);
}

/** The leaf within a door's wall, as fractions of the face (as dungeon-view.ts lays it). */
export const LEAF = { u0: 0.25, u1: 0.75, v0: 0.2 } as const;
const PLANKS = 5;

/** A texel of a wall with a door in it: stone, a timber frame, and the planked leaf. */
export function door(u: number, v: number, seed: number): number {
  const tu = grid(u);
  const tv = grid(v);
  const [l, r, top] = [LEAF.u0 * TEXELS, LEAF.u1 * TEXELS, LEAF.v0 * TEXELS];
  const frame = 3;
  if (tu < l - frame || tu >= r + frame || tv < top - frame) return stone(u, v, seed);
  if (tu < l || tu >= r || tv < top) {
    // The frame: lit on its outer edge, dark against the leaf.
    const outer = tu === l - frame || tu === r + frame - 1 || tv === top - frame;
    return texel(MAT.wood, outer ? 0.5 : 0.3);
  }
  const lu = (tu - l) / (r - l);
  const lv = (tv - top) / (TEXELS - top);
  // A ring to pull it by.
  const [ru, rv] = [(0.72 - lu) * (r - l), (0.56 - lv) * (TEXELS - top)];
  const ring = Math.hypot(ru, rv);
  if (ring > 1.6 && ring < 3.1) return texel(MAT.iron, rv > 0 ? 0.75 : 0.45);
  // Two iron bands, studded.
  for (const band of [0.16, 0.8]) {
    const d = Math.abs(lv - band) * (TEXELS - top);
    if (d < 2.2) {
      const stud = (tu - l) % 5 === 2 && d < 0.9;
      return texel(MAT.iron, stud ? 0.85 : d < 1 ? 0.55 : 0.4);
    }
  }
  const plank = Math.floor(lu * PLANKS);
  const px = lu * PLANKS - plank;
  if (px < 0.12) return texel(MAT.wood, 0.14);
  const grain = noise(seed, plank, Math.floor(tv / 3)) - 0.5;
  const knot = noise(seed, plank, tv, 13) < 0.015 ? -0.18 : 0;
  return texel(MAT.wood, 0.5 + grain * 0.14 + (px > 0.85 ? -0.08 : 0) + knot);
}

/** How far the hole reaches from its middle at an angle, as a fraction of the face. */
function reach(angle: number, seed: number): number {
  const bins = 14;
  const t = ((angle / (2 * Math.PI) + 1) % 1) * bins;
  const i = Math.floor(t);
  const a = noise(seed, i, 21);
  const b = noise(seed, (i + 1) % bins, 21);
  return 0.3 + (a + (b - a) * (t - i)) * 0.12;
}

/** A texel of a wall dug through by magic: ragged-edged and open to the floor, rubble at its foot. */
export function dug(u: number, v: number, seed: number): number {
  const du = u - 0.5;
  const dv = (v - 0.72) * 1.15;
  const r = reach(Math.atan2(dv, du), seed);
  const d = Math.hypot(du, dv);
  // Open down to the floor below the middle; the rubble heaped across the foot.
  const inside = d < r || (v > 0.72 && Math.abs(du) < r);
  if (!inside) {
    if (d < r + 0.035 || (v > 0.72 && Math.abs(du) < r + 0.035))
      return texel(MAT.stone, 0.24 + noise(seed, grid(u), grid(v), 4) * 0.1);
    return stone(u, v, seed);
  }
  const heap = 0.93 - Math.abs(du) * 0.25 + (noise(seed, grid(u / 3), 31) - 0.5) * 0.06;
  if (v > heap) {
    const lump = noise(seed, Math.floor(grid(u) / 4), Math.floor(grid(v) / 3), 33);
    return texel(MAT.stone, 0.3 + lump * 0.32);
  }
  return CLEAR;
}
