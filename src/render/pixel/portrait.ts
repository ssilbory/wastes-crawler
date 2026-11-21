// The fight screen's combatants as pixel art (docs/presentation-plan.md, V8): each slot's figure
// (figure-view.ts) filled into a 32 by 32 frame, shown at twice that, with the same ramps, black
// outline, and lit rim as the dungeon's sprites. The party is pale as bone and its foes rust red,
// both lit from the upper left; each stands on a soft shadow, and a fallen one lies in a longer
// one. Everything outside the figure and its shadow is left clear.
import { FIGHT_LIGHT } from '../figure-draw.ts';
import type { FigureView } from '../figure-view.ts';
import { BEYOND, newFrame, put, type Frame } from './frame.ts';
import { MAT, SHADES, type Mat, type Rgb } from './palette.ts';
import { paletteFor } from './shade.ts';
import { drawSprite, figureSprite, LOOKS, type Rasterize, type Sprite } from './sprites.ts';

/** A portrait's width and height in pixels. */
export const PORTRAIT = 32;

/** The light a fight is seen by: plain and warm, with no distance to dim it. */
export const FIGHT_TINT = '#ffe6c4';

/** The depth that marks a pixel of ground shadow, behind the figure and in front of nothing. */
const SHADOW = 50;
/** How dark the ground shadow is, out of 255. */
const SHADOW_ALPHA = 110;

/** Which side of the field a figure stands on: the party near, its foes far. */
export type FieldSide = 'near' | 'far';

const SIZE = { width: PORTRAIT, height: PORTRAIT };

/** A figure in its portrait, standing or down. */
export const portraitSprite = (figure: FigureView, down: boolean, side: FieldSide): Sprite =>
  figureSprite(
    figure,
    { x: 0, y: 0, size: PORTRAIT, light: FIGHT_LIGHT, mirror: false },
    side === 'far' ? LOOKS.enemy : LOOKS.party,
    1,
    SIZE,
    down,
  );

/** A flat oval of shadow at the figure's feet: wider for one lying down. */
function shadow(f: Frame, down: boolean): void {
  const cx = PORTRAIT / 2;
  const cy = PORTRAIT - 2;
  const rx = down ? 13 : 9;
  const ry = 1.6;
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++)
      if (((x + 0.5 - cx) / rx) ** 2 + ((y + 0.5 - cy) / ry) ** 2 <= 1)
        put(f, y * f.width + x, MAT.void, 0, SHADOW);
}

/** The portrait's frame: the shadow, then the figure over it. */
export function portraitFrame(
  figure: FigureView,
  down: boolean,
  side: FieldSide,
  raster: Rasterize,
): Frame {
  const f = newFrame(PORTRAIT, PORTRAIT);
  shadow(f, down);
  drawSprite(f, portraitSprite(figure, down, side), raster);
  return f;
}

/** A brightness as its nearest ramp step: a portrait is flat bands of colour, never dithered. */
export const band = (level: number): number =>
  Math.round(Math.max(0, Math.min(1, level)) * (SHADES - 1));

/**
 * The frame as RGBA: each pixel the nearest step of its ramp under the fight's light, the shadow a
 * see-through black, and the rest clear.
 */
export function portraitRGBA(f: Frame, tint = FIGHT_TINT): Uint8ClampedArray<ArrayBuffer> {
  const pal = paletteFor(tint);
  const out = new Uint8ClampedArray(f.width * f.height * 4);
  for (let y = 0; y < f.height; y++)
    for (let x = 0; x < f.width; x++) {
      const i = y * f.width + x;
      const depth = f.depth[i] as number;
      if (depth === BEYOND) continue;
      if (depth === SHADOW) {
        out[i * 4 + 3] = SHADOW_ALPHA;
        continue;
      }
      const rgb = (pal[f.mat[i] as Mat] as Rgb[])[band(f.level[i] as number)] as Rgb;
      out.set(rgb, i * 4);
      out[i * 4 + 3] = 255;
    }
  return out;
}
