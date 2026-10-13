import { describe, expect, it } from 'vitest';
import type { Quad } from '../../src/render/dungeon-detail.ts';
import { trapArt, type TrapEffect } from '../../src/render/trap-art.ts';

const floor: Quad = [
  [100, 160],
  [220, 160],
  [260, 220],
  [60, 220],
];
const across: Quad = [
  [80, 60],
  [240, 60],
  [240, 190],
  [80, 190],
];
const shapes = (d: string) => (d.match(/Z/g) ?? []).length;
const strokes = (d: string) => d.split('M').length - 1;
const art = (effect: TrapEffect, disarmed = false) =>
  trapArt(floor, across, '4,6', { effect, disarmed });

describe('known trap art', () => {
  it('rings every trap in the party’s chalk, and strikes it through once disarmed', () => {
    for (const effect of ['damage', 'poison', 'disease', 'alarm'] as const) {
      expect(strokes(art(effect).chalk)).toBe(1);
      expect(strokes(art(effect, true).chalk)).toBe(2);
    }
    // The ring wobbles by the cell, the same each time.
    expect(art('damage').chalk).toBe(art('damage').chalk);
    expect(trapArt(floor, across, '5,6', { effect: 'damage', disarmed: false }).chalk).not.toBe(
      art('damage').chalk,
    );
  });

  it('sets nine spike holes in a harmful plate, wedged once disarmed', () => {
    expect(art('damage')).toMatchObject({ plate: true, stain: '', stainKind: null, wedge: '' });
    expect(shapes(art('damage').holes)).toBe(9);
    expect(shapes(art('damage', true).wedge)).toBe(1);
  });

  it('marks poison with two needle holes and a green stain', () => {
    const poison = art('poison');
    expect(shapes(poison.holes)).toBe(2);
    expect(poison).toMatchObject({ plate: true, stainKind: 'poison' });
    expect(shapes(poison.stain)).toBe(1);
  });

  it('spills filth over a disease plate, with flecks about it', () => {
    const filth = art('disease');
    expect(filth).toMatchObject({ plate: true, stainKind: 'disease' });
    expect(shapes(filth.stain)).toBe(1);
    expect(shapes(filth.holes)).toBe(3);
  });

  it('strings an alarm’s wire wall to wall at ankle height, and hangs it cut once disarmed', () => {
    const wire = art('alarm');
    expect(wire).toMatchObject({ plate: false, stain: '', wedge: '' });
    // Across the upright plane, a tenth of the way up from the floor.
    expect(wire.wire).toBe('M80.0,177.0L240.0,177.0');
    expect(shapes(wire.holes)).toBe(2);
    const cut = art('alarm', true);
    expect(strokes(cut.wire)).toBe(2);
    expect(cut.wedge).toBe('');
  });
});
