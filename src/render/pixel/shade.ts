// Lighting the pixel view (docs/presentation-plan.md, V8): each pixel's brightness in full light,
// dimmed by the dark with its distance (dungeon-light.ts), warmed by the pool at the party's feet
// and by any brazier or candles near it (dungeon-lamps.ts), then dithered to a step of its material's ramp under that light. Fire and the black of
// magical darkness keep their own brightness. Returns RGBA, ready for a canvas.
import { darkness, poolAt, type LightView } from '../dungeon-light.ts';
import { lampLight, lateralAt, type Lamp } from '../dungeon-lamps.ts';
import type { Flicker } from '../../data/schemas/index.ts';
import type { Frame } from './frame.ts';
import { glows, palette, step, type Mat, type Rgb } from './palette.ts';

/** What the dark leaves of a lit surface past the light's reach: shapes, not nothing. */
const AMBIENT = 0.18;

/** How much the light carried low in the middle of the view lifts what is near its glow. */
const GLOW = 0.28;

const palettes = new Map<string, Rgb[][]>();
/** The ramps under a light's colour, built once per colour. */
export function paletteFor(tint: string): Rgb[][] {
  let p = palettes.get(tint);
  if (!p) {
    p = palette(tint);
    palettes.set(tint, p);
  }
  return p;
}

/** How bright a pixel is, from 0 to 1, before it is dithered. */
export function brightness(
  light: LightView,
  mat: Mat,
  level: number,
  depth: number,
  glow: number,
  flicker: number,
  /** How brightly braziers and candles light this spot (dungeon-lamps.ts). */
  lamp = 0,
): number {
  if (glows(mat)) return level;
  const lit =
    (AMBIENT + (1 - AMBIENT) * (1 - darkness(light, depth))) *
    flicker *
    (1 - GLOW / 2 + GLOW * glow);
  return level * lit + poolAt(light, depth) * level * 0.9 + level * lamp * 1.3;
}

/** How near a pixel is to the light's glow, low in the middle of the view: 1 there, 0 far off. */
export function glowAt(x: number, y: number, width: number, height: number): number {
  const d = Math.hypot((x - width / 2) / (width * 0.62), (y - height * 1.05) / (height * 0.8));
  return Math.max(0, 1 - d);
}

/**
 * The frame lit by `light`, as RGBA. `flicker` scales the light (not its pool), so a torch's
 * frames can be drawn a little dimmer and stepped between.
 */
export function lightFrame(
  f: Frame,
  light: LightView,
  flicker = 1,
  lamps: readonly Lamp[] = [],
): Uint8ClampedArray<ArrayBuffer> {
  const pal = paletteFor(light.tint);
  const out = new Uint8ClampedArray(f.width * f.height * 4);
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = y * f.width + x;
      const mat = f.mat[i] as Mat;
      const depth = f.depth[i] as number;
      const lamp = lamps.length > 0 ? lampLight(lamps, depth, lateralAt(x + 0.5, depth)) : 0;
      const v = brightness(
        light,
        mat,
        f.level[i] as number,
        depth,
        glowAt(x, y, f.width, f.height),
        flicker,
        lamp,
      );
      const rgb = (pal[mat] as Rgb[])[step(v, x, y)] as Rgb;
      out.set(rgb, i * 4);
      out[i * 4 + 3] = 255;
    }
  return out;
}

/** A torch's three frames at each strength of flicker, brightest first (the Torch flicker setting). */
const FLICKERS: Record<Flicker, number[]> = {
  off: [1],
  low: [1, 0.95, 0.91],
  normal: [1, 0.9, 0.82],
  high: [1, 0.82, 0.7],
};

/** The frames a light is drawn in: a torch steps between three, any other light holds one. */
export const flickers = (light: LightView, amount: Flicker = 'normal'): number[] =>
  light.flicker ? FLICKERS[amount] : [1];
