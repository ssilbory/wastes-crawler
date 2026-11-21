// The pixel view's colours (docs/presentation-plan.md, V8): every material is a ramp of eight shades
// from the shared near-black up to its brightest, the shadows leaning cool and the highlights warm,
// as hand-shaded pixel art does. The ramps are built for each light, so a torch warms the stone it
// lights and sight without light leaves it cold; the view never shows a colour outside them.

/** What a pixel is made of, which picks its ramp. */
export const MAT = {
  void: 0,
  stone: 1,
  mortar: 2,
  wood: 3,
  iron: 4,
  flag: 5,
  ceiling: 6,
  moss: 7,
  flame: 8,
  water: 9,
  chalk: 10,
  poison: 11,
  filth: 12,
  cloth: 13,
  foe: 14,
  glint: 15,
  darkness: 16,
  rust: 17,
} as const;

export type Mat = (typeof MAT)[keyof typeof MAT];

/** Shades per ramp. */
export const SHADES = 8;

/** A colour as [r, g, b], each 0 to 255. */
export type Rgb = [number, number, number];

/** A material's brightest shade as hue (degrees), saturation and lightness (0 to 1). */
interface Base {
  h: number;
  s: number;
  l: number;
  /** Makes its own light: ignores the dark, and the light's tint. */
  glows?: boolean;
}

const BASES: Record<Mat, Base> = {
  [MAT.void]: { h: 250, s: 0.2, l: 0.04 },
  [MAT.stone]: { h: 34, s: 0.2, l: 0.74 },
  [MAT.mortar]: { h: 28, s: 0.16, l: 0.42 },
  [MAT.wood]: { h: 24, s: 0.48, l: 0.56 },
  [MAT.iron]: { h: 215, s: 0.1, l: 0.62 },
  [MAT.flag]: { h: 30, s: 0.16, l: 0.66 },
  [MAT.ceiling]: { h: 222, s: 0.1, l: 0.6 },
  [MAT.moss]: { h: 88, s: 0.34, l: 0.5 },
  [MAT.flame]: { h: 38, s: 1, l: 0.86, glows: true },
  [MAT.water]: { h: 204, s: 0.46, l: 0.66 },
  [MAT.chalk]: { h: 45, s: 0.2, l: 0.92 },
  [MAT.poison]: { h: 96, s: 0.46, l: 0.5 },
  [MAT.filth]: { h: 52, s: 0.36, l: 0.34 },
  [MAT.cloth]: { h: 38, s: 0.22, l: 0.76 },
  [MAT.foe]: { h: 20, s: 0.22, l: 0.62 },
  [MAT.glint]: { h: 36, s: 0.72, l: 0.8, glows: true },
  [MAT.darkness]: { h: 0, s: 0, l: 0.01, glows: true },
  [MAT.rust]: { h: 14, s: 0.5, l: 0.66 },
};

/** Whether a material makes its own light. */
export const glows = (m: Mat): boolean => BASES[m].glows === true;

/** HSL (hue in degrees, the rest 0 to 1) as RGB. */
export function hsl(h: number, s: number, l: number): Rgb {
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => {
    const k = (n + h / 30) % 12;
    return Math.round(255 * (l - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))));
  };
  return [f(0), f(8), f(4)];
}

/** '#rrggbb' as RGB. */
export function hex(color: string): Rgb {
  const n = parseInt(color.slice(1, 7), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** The hue `t` of the way from `from` to `to`, the short way round. */
function lean(from: number, to: number, t: number): number {
  const d = ((to - from + 540) % 360) - 180;
  return (from + d * t + 360) % 360;
}

/** Where shadows lean, and where highlights lean. */
const COOL = 255;
const WARM = 48;
/** The shared darkest shade's lightness. */
const FLOOR_L = 0.035;

/**
 * A material's eight shades under a light of colour `tint`: shadows lean toward blue-violet and
 * highlights toward gold, and the brighter shades take on the light's colour.
 */
export function ramp(m: Mat, tint: string): Rgb[] {
  const b = BASES[m];
  const light = hex(tint);
  const top = Math.max(...light, 1);
  return Array.from({ length: SHADES }, (_, i) => {
    const t = i / (SHADES - 1);
    const l = FLOOR_L + (b.l - FLOOR_L) * t ** 1.1;
    const h = t < 0.5 ? lean(b.h, COOL, (0.5 - t) * 0.5) : lean(b.h, WARM, (t - 0.5) * 0.24);
    const rgb = hsl(h, b.s * (0.7 + 0.3 * t), l);
    if (b.glows) return rgb;
    // The brighter the shade, the more of the light's own colour it carries.
    const pull = 0.55 * t;
    return rgb.map((c, k) =>
      Math.min(255, Math.round(c * (1 - pull + (pull * (light[k] as number)) / top))),
    ) as Rgb;
  });
}

/** Every material's ramp under one light, indexed by material then shade. */
export function palette(tint: string): Rgb[][] {
  return (Object.values(MAT) as Mat[]).map((m) => ramp(m, tint));
}

/**
 * The 4 by 4 ordered-dither thresholds, from 0 up to just under 1: adding one to a shade's place
 * between two ramp steps and flooring it picks the lower or upper step in a fixed crosshatch.
 */
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
export const bayer = (x: number, y: number): number =>
  ((BAYER[(y & 3) * 4 + (x & 3)] as number) + 0.5) / 16;

/** The ramp step for a brightness from 0 to 1 at pixel (x, y), dithered between two steps. */
export function step(v: number, x: number, y: number): number {
  const s = Math.floor(Math.max(0, Math.min(1, v)) * (SHADES - 1) + bayer(x, y));
  return Math.min(SHADES - 1, s);
}
