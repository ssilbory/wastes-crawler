import { describe, expect, it } from 'vitest';
import { MonsterFigureSchema, HeldSchema } from '../../src/data/schemas/index.ts';
import {
  figureTransform,
  NORMAL_SCALE,
  personParts,
  ring,
  shift,
  SMALL_SCALE,
  type PersonView,
} from '../../src/render/figure-art.ts';
import {
  drawFigure,
  facesMiddle,
  FIGHT_LIGHT,
  lightFrom,
  RELIEF,
} from '../../src/render/figure-draw.ts';
import { monsterParts, UPRIGHT } from '../../src/render/monster-art.ts';

const person = (over: Partial<PersonView> = {}): PersonView => ({
  kind: 'person',
  body: 'standard',
  head: 'plain',
  garb: 'cloak',
  held: 'fist',
  shield: false,
  ...over,
});

/** Every number in a path, for bounds checks. */
const numbers = (d: string) => (d.match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('figure art (docs/presentation-plan.md, V3)', () => {
  it('draws rings and moves paths, H and V included, leaving relative moves alone', () => {
    expect(ring(10, 10, 2)).toBe('M8,10a2,2 0 1,0 4,0a2,2 0 1,0 -4,0Z');
    const p = { kind: 'fill' as const, d: 'M1,2L3,4Q5,6 7,8H9V10a1,1 0 1,0 2,0Z' };
    expect(shift(p, 10, 20).d).toBe('M11,22L13,24Q15,26,17,28H19V30a1,1 0 1,0 2,0Z');
    expect(shift(p, 0, 0)).toBe(p);
  });

  it('builds a person back to front: a cloak behind, then legs, body, head, and kit', () => {
    const cloaked = personParts(person());
    expect(cloaked[0]?.d).toMatch(/^M17\.2,15/);
    expect(cloaked[1]?.d).toMatch(/^M18\.5,29/);
    const armed = personParts(person({ garb: 'armor', held: 'great', shield: true }));
    expect(armed.length).toBeGreaterThan(cloaked.length);
    expect(armed.at(-1)?.kind).toBe('cut');
  });

  it('gives every head, garb, and weapon its own drawing', () => {
    const base = personParts(person()).length;
    for (const head of ['ears', 'horns', 'tusks', 'beard'] as const)
      expect(personParts(person({ head })).length).toBeGreaterThan(base);
    for (const held of HeldSchema.options.filter((h) => h !== 'fist'))
      expect(personParts(person({ held })).length).toBeGreaterThan(base);
    expect(personParts(person({ garb: 'robe' }))).not.toEqual(personParts(person()));
  });

  it('sets a centaur’s rider half on a horse, without a cloak or legs', () => {
    const parts = personParts(person({ body: 'centaur', held: 'bow' }));
    expect(parts[0]?.d).toMatch(/^M10,27/);
    expect(parts.some((p) => p.d.startsWith('M18.5,29'))).toBe(false);
    expect(parts.some((p) => p.d.startsWith('M17.2,15'))).toBe(false);
    // The rider's head moves forward and up with the rest of its half.
    expect(parts.some((p) => p.d.startsWith('M12.8,7'))).toBe(true);
  });

  it('has a drawing for every monster figure, inside the box', () => {
    for (const f of MonsterFigureSchema.options) {
      const parts = monsterParts(f);
      expect(parts.length, f).toBeGreaterThan(0);
      for (const p of parts) {
        const abs = p.d.replace(/a[^A-Za-z]*/g, '');
        for (const n of numbers(abs)) expect(n, f).toBeGreaterThanOrEqual(0);
        for (const n of numbers(abs)) expect(n, f).toBeLessThanOrEqual(48);
      }
    }
    // Brutes and giants are drawn wider than a soldier.
    const span = (f: 'brute' | 'giant' | 'commoner') =>
      Math.max(...monsterParts(f).flatMap((p) => numbers(p.d.split('Q')[0] ?? '')));
    expect(span('giant')).toBeGreaterThan(span('commoner'));
  });

  it('sizes and fells figures', () => {
    const big = { kind: 'monster' as const, shape: 'giant' as const, large: true };
    expect(figureTransform(big, false, true)).toBe('translate(0,0) scale(1)');
    expect(figureTransform(person(), false, true)).toBe(
      `translate(3.36,6.44) scale(${NORMAL_SCALE})`,
    );
    const s = Math.round(NORMAL_SCALE * SMALL_SCALE * 1000) / 1000;
    expect(figureTransform(person({ body: 'small' }), false, true)).toContain(`scale(${s})`);
    expect(figureTransform(big, true, true)).toContain('rotate(90,24,24)');
    expect(figureTransform(big, true, false)).toContain('scale(1,-1)');
  });

  it('fells upright figures on their side and beasts on their back', () => {
    expect(UPRIGHT.has('soldier')).toBe(true);
    expect(UPRIGHT.has('beast')).toBe(false);
    const beast = { kind: 'monster' as const, shape: 'beast' as const, large: false };
    expect(drawFigure(beast, true).transform).toContain('scale(1,-1)');
    expect(drawFigure(person(), true).transform).toContain('rotate(90');
    expect(drawFigure({ ...beast, shape: 'tree' }, true).transform).toContain('rotate(90');
    expect(drawFigure(person(), false).parts).toEqual(personParts(person()));
    // A standing figure is shaded from the upper left; a fallen one lies flat.
    expect(drawFigure(person(), false).relief).toEqual(FIGHT_LIGHT);
    expect(FIGHT_LIGHT).toEqual([RELIEF, RELIEF]);
    expect(drawFigure(beast, false, [1, 2]).relief).toEqual([1, 2]);
    expect(drawFigure(person(), true).relief).toBeNull();
    expect(RELIEF).toBeGreaterThan(0);
    // In the corridor, the party's light catches the top and the side toward the middle.
    const [midX, midY] = lightFrom(160);
    expect(Math.abs(midX)).toBe(0);
    expect(midY).toBeGreaterThan(0);
    // Shifted away from the lit side: left of the middle shifts left, so its right edge is lit.
    expect(lightFrom(40)[0]).toBeLessThan(0);
    expect(lightFrom(280)[0]).toBeGreaterThan(0);
    expect(lightFrom(-500)).toEqual(lightFrom(0));
    expect(lightFrom(900)).toEqual(lightFrom(320));
    // A beast left of the middle turns to face it, its light turning with it; one standing
    // upright faces the viewer and stays as it is.
    expect(facesMiddle(40)).toBe(true);
    expect(facesMiddle(160)).toBe(false);
    expect(facesMiddle(280)).toBe(false);
    const turned = drawFigure(beast, false, [1, 2], true);
    expect(turned.transform.startsWith('translate(48,0) scale(-1,1) ')).toBe(true);
    expect(turned.relief).toEqual([-1, 2]);
    expect(drawFigure(beast, false, [1, 2], false).transform).not.toContain('scale(-1');
    expect(drawFigure(person(), false, [1, 2], true)).toEqual(drawFigure(person(), false, [1, 2]));
  });
});
