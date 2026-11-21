// The ground of each terrain on the pixel overland (docs/presentation-plan.md, V8): grass, forest
// floor, moss and puddles, sand, salt, stone, red earth, and open water with its ripples. Each sits
// on one step of its ramp, flecked here and there a step lighter or darker by a hash of the pixel,
// as a pixel artist would, so a hex is neither one flat colour nor noise. Glyphs (bitmaps.ts) stand
// on it. The same pixel always gets the same texel.
import { MAT, SHADES } from './palette.ts';
import { noise, texel } from './texel.ts';

const SEED = 0x51ab;

/** Step `k` of a ramp, as a brightness. */
export const at = (k: number): number => k / (SHADES - 1);

/** Terrains of open water, which get a shore. Rivers and fords are land with a river through. */
export const isWater = (terrain: string): boolean => terrain === 'lake';

/** The texel of `terrain`'s ground at pixel (x, y). */
export function ground(terrain: string, x: number, y: number): number {
  const n = noise(SEED, x, y);
  // A fleck a step lighter, or a step darker, on a few pixels in a hundred.
  const v = (k: number) => at(k + (n < 0.035 ? 1 : n > 0.975 ? -1 : 0));
  switch (terrain) {
    case 'forest':
      return texel(MAT.grass, v(3));
    case 'deep-forest':
      return texel(MAT.leaf, v(2));
    case 'hills':
      return texel(MAT.moss, v(4));
    case 'mountains':
      return texel(MAT.stone, v(3));
    case 'peaks':
      return texel(MAT.stone, v(4));
    case 'swamp':
      // Pools of standing water in the moss, a few pixels across.
      return noise(SEED, x >> 2, y >> 1, 2) < 0.22 ? texel(MAT.water, v(2)) : texel(MAT.moss, v(3));
    case 'badlands':
      return texel(MAT.rust, n < 0.05 ? at(2) : v(4));
    case 'lake':
      // Short ripples in rows.
      return texel(MAT.water, (x + (y >> 2) * 3) % 7 < 2 && y % 4 === 0 ? at(5) : v(4));
    case 'desert':
    case 'oasis':
      return texel(MAT.sand, v(4));
    case 'dunes':
      return texel(MAT.sand, v(5));
    case 'salt-flats':
      return n < 0.04 ? texel(MAT.stone, at(4)) : texel(MAT.snow, v(5));
    default:
      // Plains, and the land a river or ford runs through.
      return texel(MAT.grass, v(4));
  }
}
