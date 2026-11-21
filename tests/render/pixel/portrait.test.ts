import { describe, expect, it } from 'vitest';
import { monsterFigureOf, type FigureView } from '../../../src/render/figure-view.ts';
import { emptyMask } from '../../../src/render/pixel/mask.ts';
import { MAT, ramp, SHADES } from '../../../src/render/pixel/palette.ts';
import {
  band,
  FIGHT_TINT,
  PORTRAIT,
  portraitFrame,
  portraitRGBA,
  portraitSprite,
} from '../../../src/render/pixel/portrait.ts';
import { LOOKS, type Rasterize } from '../../../src/render/pixel/sprites.ts';
import { data } from '../../game/combat/helpers.ts';

/** Stands in for the browser: each shape covers the middle of its box. */
const raster: Rasterize = (s) => {
  const m = emptyMask(s.box.x, s.box.y, s.box.w, s.box.h);
  for (let y = 8; y < 28; y++) for (let x = 10; x < 22; x++) m.on[y * m.w + x] = 1;
  return m;
};

const thug: FigureView = monsterFigureOf(data, 'thug-or-militia');

describe('fight portraits (docs/presentation-plan.md, V8)', () => {
  it('colours the party bone-pale and its foes rust red, lit from the upper left', () => {
    const near = portraitSprite(thug, false, 'near');
    const far = portraitSprite(thug, false, 'far');
    expect(near.layers.find((l) => l.body)?.mat).toBe(LOOKS.party.body[0]);
    expect(far.layers.find((l) => l.body)?.mat).toBe(MAT.rust);
    expect(near.relief).not.toBeNull();
    // A fallen figure lies flat, with no relief.
    expect(portraitSprite(thug, true, 'near').relief).toBeNull();
  });

  it('stands the figure on a see-through shadow, outlined, the rest clear', () => {
    const f = portraitFrame(thug, false, 'far', raster);
    expect(f.width).toBe(PORTRAIT);
    const rgba = portraitRGBA(f);
    const alpha = (x: number, y: number) => rgba[(y * PORTRAIT + x) * 4 + 3];
    // Clear in the corner, opaque in the body, a black outline beside it.
    expect(alpha(0, 0)).toBe(0);
    expect(alpha(15, 15)).toBe(255);
    expect(alpha(9, 15)).toBe(255);
    expect([...rgba.slice((15 * PORTRAIT + 9) * 4, (15 * PORTRAIT + 9) * 4 + 3)]).toEqual(
      ramp(MAT.void, FIGHT_TINT)[0],
    );
    // The shadow at the feet shows through, wider for a fallen figure.
    const shadowAt = (rows: Uint8ClampedArray, x: number) =>
      rows[((PORTRAIT - 2) * PORTRAIT + x) * 4 + 3];
    expect(shadowAt(rgba, 8)).toBeGreaterThan(0);
    expect(shadowAt(rgba, 8)).toBeLessThan(255);
    expect(shadowAt(rgba, 4)).toBe(0);
    const fallen = portraitRGBA(portraitFrame(thug, true, 'near', raster));
    expect(shadowAt(fallen, 4)).toBeGreaterThan(0);
  });

  it('paints flat bands of colour, never dithered', () => {
    expect(band(0)).toBe(0);
    expect(band(1)).toBe(SHADES - 1);
    expect(band(-1)).toBe(0);
    expect(band(2)).toBe(SHADES - 1);
    expect(band(0.5)).toBe(Math.round(0.5 * (SHADES - 1)));
    const rgba = portraitRGBA(portraitFrame(thug, false, 'near', raster));
    // Two neighbours inside the body share a colour.
    const at = (x: number, y: number) => [
      ...rgba.slice((y * PORTRAIT + x) * 4, (y * PORTRAIT + x) * 4 + 3),
    ];
    expect(at(15, 18)).toEqual(at(16, 18));
  });
});
