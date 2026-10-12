// Smooth random fields for the overland map editor's random regions (Sam's call: an authoring
// tool, not a rule). Value noise on a coarse lattice, eased between lattice points.
import type { Rng } from '../../rules/rng.ts';

const OCTAVES = [
  { step: 6, weight: 0.65 },
  { step: 3, weight: 0.35 },
] as const;

const ease = (t: number) => t * t * (3 - 2 * t);
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/**
 * A value from 0 to 1 for every hex of a width × height map, by [row][col]: two octaves of value
 * noise, stretched to fill the range. Odd columns sit half a hex lower, as on the map.
 */
export function noiseField(rng: Rng, width: number, height: number): number[][] {
  const field = Array.from({ length: height }, () => new Array<number>(width).fill(0));
  for (const { step, weight } of OCTAVES) {
    const gw = Math.ceil(width / step) + 2;
    const gh = Math.ceil(height / step) + 2;
    const lattice = Array.from({ length: gh }, () => Array.from({ length: gw }, () => rng.next()));
    const at = (gx: number, gy: number) => (lattice[gy] as number[])[gx] as number;
    for (let row = 0; row < height; row++)
      for (let col = 0; col < width; col++) {
        const fx = col / step;
        const fy = (row + (col % 2) * 0.5) / step;
        const ix = Math.floor(fx);
        const iy = Math.floor(fy);
        const tx = ease(fx - ix);
        const ty = ease(fy - iy);
        const top = lerp(at(ix, iy), at(ix + 1, iy), tx);
        const bottom = lerp(at(ix, iy + 1), at(ix + 1, iy + 1), tx);
        const line = field[row] as number[];
        line[col] = (line[col] as number) + weight * lerp(top, bottom, ty);
      }
  }
  const all = field.flat();
  const min = Math.min(...all);
  const span = Math.max(...all) - min;
  return field.map((r) => r.map((v) => (span === 0 ? 0.5 : (v - min) / span)));
}
