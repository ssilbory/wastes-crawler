import { describe, expect, it } from 'vitest';
import {
  formModifier,
  intrinsicAc,
  pliantHeal,
  shiftedHp,
  talonsBonus,
} from '../../src/rules/forms.ts';

describe('form arts (1.5.15)', () => {
  it('raises a modifier by 1, to a maximum of +2', () => {
    expect([-1, 0, 1, 2, 3].map(formModifier)).toEqual([0, 1, 2, 2, 3]);
  });

  it('sharpens Savage Talons at levels 3, 6, and 9', () => {
    expect([1, 2, 3, 5, 6, 9, 12].map(talonsBonus)).toEqual([0, 0, 1, 1, 2, 3, 3]);
  });

  it('gives Intrinsic Armor a base AC of 14 plus half the level, rounded down', () => {
    expect([1, 2, 3, 10].map(intrinsicAc)).toEqual([14, 15, 15, 19]);
  });

  it('moves hit points with a Con change, never felling the conscious', () => {
    expect(shiftedHp({ max: 20, current: 20 }, 3, 1)).toEqual({ max: 23, current: 23 });
    expect(shiftedHp({ max: 23, current: 2 }, 3, -1)).toEqual({ max: 20, current: 1 });
    expect(shiftedHp({ max: 23, current: 0 }, 3, -1)).toEqual({ max: 20, current: 0 });
  });

  it('heals 1d6 plus the level with Pliant Flesh', () => {
    expect(pliantHeal(4, 3)).toBe(7);
  });
});
