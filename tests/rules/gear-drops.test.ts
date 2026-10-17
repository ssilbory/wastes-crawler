import { describe, expect, it } from 'vitest';
import {
  bandAt,
  cutLoot,
  dropTier,
  fineFind,
  pickWeighted,
  type DropBand,
} from '../../src/rules/gear-drops.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const w = (jury: number, normal: number, master: number): DropBand['weights'] => ({
  'jury-rigged': jury,
  normal,
  mastercrafted: master,
});
const BANDS: DropBand[] = [
  { minLevel: 5, weights: w(0, 1, 0) },
  { minLevel: 1, weights: w(1, 0, 0) },
  { minLevel: 7, weights: w(0, 2, 1) },
];

describe('gear drop tiers (docs/rules-adaptation.md, Gear drops)', () => {
  it('takes the band with the highest minimum at or under the level, in any order', () => {
    expect(bandAt(BANDS, 1).minLevel).toBe(1);
    expect(bandAt(BANDS, 4).minLevel).toBe(1);
    expect(bandAt(BANDS, 5).minLevel).toBe(5);
    expect(bandAt(BANDS, 6).minLevel).toBe(5);
    expect(bandAt(BANDS, 20).minLevel).toBe(7);
  });

  it('falls back to the lowest band below every minimum', () => {
    expect(bandAt([{ minLevel: 3, weights: w(1, 0, 0) }], 1).minLevel).toBe(3);
    const high = [
      { minLevel: 6, weights: w(0, 1, 0) },
      { minLevel: 3, weights: w(1, 0, 0) },
      { minLevel: 9, weights: w(0, 0, 1) },
    ];
    expect(bandAt(high, 1).minLevel).toBe(3);
    expect(bandAt(high, 2).minLevel).toBe(3);
  });

  it('draws by weight and never draws a zero weight', () => {
    const entries = [
      ['a', 0],
      ['b', 2],
      ['c', 1],
    ] as const;
    expect(pickWeighted(scriptedRng([1]), entries)).toBe('b');
    expect(pickWeighted(scriptedRng([2]), entries)).toBe('b');
    expect(pickWeighted(scriptedRng([3]), entries)).toBe('c');
    expect(() => pickWeighted(scriptedRng([1]), [['a', 0]] as const)).toThrow('every weight');
  });

  it('drops jury-rigged early, normal later, and mastercrafted at high level', () => {
    expect(dropTier(scriptedRng([1]), BANDS, 1)).toBe('jury-rigged');
    expect(dropTier(scriptedRng([1]), BANDS, 5)).toBe('normal');
    expect(dropTier(scriptedRng([2]), BANDS, 8)).toBe('normal');
    expect(dropTier(scriptedRng([3]), BANDS, 8)).toBe('mastercrafted');
  });
});

describe('cutting the loot dice for a drop', () => {
  it('takes the smallest dice first until their average covers the item', () => {
    // 3.5 + 3.5 covers 6 crowns; the d8s stay.
    expect(
      cutLoot(
        [
          { count: 2, sides: 8 },
          { count: 6, sides: 6 },
        ],
        6,
        0.75,
      ),
    ).toEqual([
      { count: 4, sides: 6 },
      { count: 2, sides: 8 },
    ]);
  });

  it('always leaves three quarters of the dice, rounded up', () => {
    expect(cutLoot([{ count: 8, sides: 6 }], 1000, 0.75)).toEqual([{ count: 6, sides: 6 }]);
    expect(cutLoot([{ count: 3, sides: 6 }], 1000, 0.75)).toEqual([{ count: 3, sides: 6 }]);
    expect(cutLoot([{ count: 1, sides: 6 }], 1000, 0.75)).toEqual([{ count: 1, sides: 6 }]);
    expect(cutLoot([], 1000, 0.75)).toEqual([]);
  });

  it('takes nothing for a worthless item', () => {
    expect(cutLoot([{ count: 4, sides: 6 }], 0, 0.75)).toEqual([{ count: 4, sides: 6 }]);
  });
});

describe('fine weapons (docs/rules-adaptation.md, Gear drops: Fine weapons)', () => {
  const W = { mastercrafted: 6, '+1': 3, '+2': 1 };

  it('draws mastercrafted, +1, or +2 by weight', () => {
    expect(fineFind(scriptedRng([6]), W)).toEqual({ quality: 'mastercrafted', bonus: 0 });
    expect(fineFind(scriptedRng([7]), W)).toEqual({ bonus: 1 });
    expect(fineFind(scriptedRng([9]), W)).toEqual({ bonus: 1 });
    expect(fineFind(scriptedRng([10]), W)).toEqual({ bonus: 2 });
  });

  it('never draws a zero weight', () => {
    expect(fineFind(scriptedRng([1]), { mastercrafted: 0, '+1': 0, '+2': 1 })).toEqual({
      bonus: 2,
    });
    expect(() => fineFind(scriptedRng([1]), { mastercrafted: 0, '+1': 0, '+2': 0 })).toThrow();
  });
});
