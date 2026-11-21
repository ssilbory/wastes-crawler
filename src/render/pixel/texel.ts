// The texel helpers every pixel texture shares (docs/presentation-plan.md, V8): a texel packed as
// its material and brightness, the grid a panel's texture is laid on, and an integer hash so
// variation follows the cell, never the RNG.
import { hash01 } from '../dungeon-quad.ts';
import type { Mat } from './palette.ts';

/** Texels across a cell-wide face. */
export const TEXELS = 64;

/** No texel: what lies behind shows through. */
export const CLEAR = -1;

/** A texel as one number: its material, and its brightness from 0 to 1 in steps of 1/255. */
export const texel = (m: Mat, level: number): number =>
  (m << 8) | Math.round(Math.max(0, Math.min(1, level)) * 255);

export const matOf = (t: number): Mat => (t >> 8) as Mat;
export const levelOf = (t: number): number => (t & 255) / 255;

/** A seed string as a 32-bit integer. */
export const seedOf = (seed: string): number => Math.floor(hash01(seed) * 0x100000000);

/** A stable number from 0 to 1 for a seed and up to three integers. */
export function noise(seed: number, a: number, b = 0, c = 0): number {
  let h = seed ^ Math.imul(a, 0x27d4eb2d) ^ Math.imul(b, 0x165667b1) ^ Math.imul(c, 0x9e3779b1);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  return ((h ^ (h >>> 16)) >>> 0) / 0x100000000;
}

/** A fraction across a face as a texel column or row, 0 to TEXELS - 1. */
export const grid = (f: number): number =>
  Math.min(TEXELS - 1, Math.max(0, Math.floor(f * TEXELS)));
