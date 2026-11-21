// Pixel textures for flat faces (docs/presentation-plan.md, V8): flagstones on the floor, slabs and
// beams overhead, stair treads going up or down, and a trap's pressure plate. Floor and ceiling
// squares run from their far edge (v = 0) to their near edge (v = 1).
import { MAT } from './palette.ts';
import { grid, noise, texel } from './texel.ts';

const FLAG = 16;

/** A texel of flagstones, laid in offset rows. */
export function flag(u: number, v: number, seed: number): number {
  const tu = grid(u);
  const tv = grid(v);
  const row = Math.floor(tv / FLAG);
  const x = tu + Math.floor(noise(seed, row, 3) * FLAG);
  const col = Math.floor(x / FLAG);
  const lx = x % FLAG;
  const ly = tv % FLAG;
  if (lx === 0 || ly === 0) return texel(MAT.mortar, 0.28);
  const slab = noise(seed, col, row);
  let level = 0.5 + (slab - 0.5) * 0.2 + (noise(seed, tu, tv) - 0.5) * 0.08;
  // Each slab catches the light along its near edge, and wears hollow in the middle.
  if (ly === FLAG - 1) level += 0.14;
  else if (ly === 1) level -= 0.1;
  if (lx === 1) level += 0.05;
  const mid = Math.hypot(lx - FLAG / 2, ly - FLAG / 2) / (FLAG / 2);
  level -= (1 - Math.min(1, mid)) * 0.06;
  if (slab < 0.1 && Math.abs(lx - (2 + ly * 0.9)) < 0.6) level -= 0.26;
  // Grit in the joints' corners.
  if (noise(seed, tu, tv, 17) < 0.02) level -= 0.18;
  return texel(MAT.flag, level);
}

/** Texel rows of the timber beam across each cell's far edge overhead. */
const BEAM = 16;

/** A texel of the ceiling: a timber beam across each cell's far edge, and stone slabs between. */
export function ceiling(u: number, v: number, seed: number): number {
  const tu = grid(u);
  const tv = grid(v);
  if (tv < BEAM) {
    // Lit along the underside facing the party, dark where it meets the slabs beyond.
    if (tv === BEAM - 1) return texel(MAT.wood, 0.56);
    if (tv < 2) return texel(MAT.wood, 0.1);
    return texel(MAT.wood, 0.34 + (noise(seed, Math.floor(tu / 7), tv, 19) - 0.5) * 0.14);
  }
  const lx = tu % 32;
  const ly = (tv - BEAM) % 27;
  if (lx === 0 || ly === 0) return texel(MAT.mortar, 0.22);
  const slab = noise(seed, Math.floor(tu / 32), Math.floor((tv - BEAM) / 27));
  let level = 0.46 + (slab - 0.5) * 0.18 + (noise(seed, tu, tv) - 0.5) * 0.07;
  if (ly === 1) level -= 0.1;
  else if (ly === 26) level += 0.1;
  // Soot gathers along the beam.
  if (tv < BEAM + 4) level -= 0.08;
  return texel(MAT.ceiling, level);
}

const TREADS = 6;

/**
 * A texel of stairs in a hole in the floor (down) or ceiling (up): treads lit along their
 * nosings, sinking into the dark going down and rising into it going up, between dark rails.
 */
export function stairs(u: number, v: number, seed: number, up: boolean): number {
  if (u < 0.07 || u > 0.93) return texel(MAT.stone, 0.18);
  const t = v * TREADS;
  const tread = Math.floor(t);
  const within = t - tread;
  // Away from the party is further down (or further up): darker, either way.
  const deep = (TREADS - 1 - tread) / (TREADS - 1);
  const nosing = up ? within > 0.82 : within < 0.18;
  const base = 0.54 - deep * 0.42 + (noise(seed, tread, grid(u)) - 0.5) * 0.06;
  return texel(MAT.stone, nosing ? base + 0.2 : base);
}

/** A texel of a trap's pressure plate: iron set proud of the floor, bevelled. */
export function plate(u: number, v: number, seed: number): number {
  const edge = Math.min(u, v, 1 - u, 1 - v);
  if (edge < 0.06) return texel(MAT.iron, v > 0.5 || u < 0.5 ? 0.6 : 0.2);
  const rivet = Math.hypot(((u * 4) % 1) - 0.5, ((v * 4) % 1) - 0.5) < 0.12;
  return texel(MAT.iron, (rivet ? 0.62 : 0.38) + (noise(seed, grid(u), grid(v)) - 0.5) * 0.08);
}
