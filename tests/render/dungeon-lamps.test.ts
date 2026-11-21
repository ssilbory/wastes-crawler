import { describe, expect, it } from 'vitest';
import { furniturePanel } from '../../src/render/dungeon-furniture.ts';
import { lampGlows, lampLight, lampsOf, lateralAt } from '../../src/render/dungeon-lamps.ts';
import { walkLight } from '../../src/render/dungeon-light.ts';
import { VIEW_WIDTH } from '../../src/render/dungeon-geometry.ts';
import { brightness } from '../../src/render/pixel/shade.ts';
import { MAT } from '../../src/render/pixel/palette.ts';

describe('braziers and candles light the dungeon (Sam’s ask)', () => {
  it('finds a lamp in each piece of furniture that burns, a brazier stronger than candles', () => {
    const lamps = lampsOf([
      furniturePanel('brazier', 2, 0),
      furniturePanel('altar', 1, -1),
      furniturePanel('bones', 1, 1),
      furniturePanel('fountain', 3, 0),
    ]);
    expect(lamps).toEqual([
      { depth: 2, lateral: 0, strength: 1 },
      { depth: 1, lateral: -1, strength: 0.65 },
    ]);
    // A burning piece of an unknown kind still glows, if less.
    const odd = furniturePanel('brazier', 1, 0);
    const art = odd.furniture as NonNullable<typeof odd.furniture>;
    expect(lampsOf([{ ...odd, furniture: { ...art, kind: 'rubble' } }])[0]?.strength).toBe(0.5);
  });

  it('lights its own square fully and the next ones less, and none past a square and a half', () => {
    const lamps = lampsOf([furniturePanel('brazier', 1, 0)]);
    const own = lampLight(lamps, 1.5, 0);
    const next = lampLight(lamps, 2.4, 0);
    expect(own).toBeGreaterThan(next);
    expect(next).toBeGreaterThan(0);
    expect(lampLight(lamps, 3.2, 0)).toBe(0);
    expect(lampLight(lamps, 1.5, 1.6)).toBe(0);
    expect(lampLight([], 1, 0)).toBe(0);
    // Further from the party, dimmer.
    const far = lampsOf([furniturePanel('brazier', 3, 0)]);
    expect(lampLight(far, 3.5, 0)).toBeLessThan(own);
    // Two lamps together never light past full.
    expect(lampLight([...lamps, ...lamps, ...lamps], 1.5, 0)).toBe(1);
  });

  it('reads a pixel’s place across the corridor from its x and its plane', () => {
    expect(lateralAt(VIEW_WIDTH / 2, 3)).toBe(0);
    expect(lateralAt(VIEW_WIDTH, 0)).toBe(0.5);
    expect(lateralAt(0, 1)).toBe(-1);
  });

  it('shows a lamp past the torch’s reach, dimly', () => {
    const torch = walkLight();
    const dark = brightness(torch, MAT.stone, 0.6, 3.5, 0, 1);
    const lit = brightness(torch, MAT.stone, 0.6, 3.5, 0, 1, 0.4);
    expect(lit).toBeGreaterThan(dark);
    expect(lit).toBeLessThan(brightness(torch, MAT.stone, 0.6, 0, 0, 1));
  });

  it('casts a glow about each lamp for the smooth view, fainter further off', () => {
    const near = furniturePanel('brazier', 1, 0);
    const glows = lampGlows([
      near,
      furniturePanel('brazier', 3, 0),
      furniturePanel('rubble', 1, 1),
    ]);
    expect(glows).toHaveLength(2);
    const [a, b] = glows as [(typeof glows)[number], (typeof glows)[number]];
    expect(a.key).toBe(`glow-${near.key}`);
    expect(a.rx).toBeGreaterThan(b.rx);
    expect(a.opacity).toBeGreaterThan(b.opacity);
    expect(a.cx).toBeCloseTo(VIEW_WIDTH / 2);
  });
});
