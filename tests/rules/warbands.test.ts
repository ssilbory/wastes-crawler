import { describe, expect, it } from 'vitest';
import { encounterWeights } from '../../src/rules/warbands.ts';

const entries = [
  { weight: 3, nature: 'hostile' as const },
  { weight: 2, nature: 'wary' as const },
  { weight: 1, nature: 'hostile' as const, warband: 'scrap-king' },
  { weight: 5, nature: 'hostile' as const },
];

describe('warband weights', () => {
  it('leaves every weight alone while no warlord has fallen', () => {
    expect(encounterWeights(entries, new Set(), false, 50)).toEqual([3, 2, 1, 5]);
  });

  it('strikes a fallen warlord’s warband and halves the hostile rest, rounding up', () => {
    expect(encounterWeights(entries, new Set(['scrap-king']), true, 50)).toEqual([2, 2, 0, 3]);
  });

  it('keeps a weight of 1 hostile at least 1', () => {
    expect(encounterWeights([{ weight: 1, nature: 'hostile' }], new Set(), true, 50)).toEqual([1]);
  });

  it('strikes a fallen warlord’s warband even on a table they didn’t thin', () => {
    expect(encounterWeights(entries, new Set(['scrap-king']), false, 50)).toEqual([3, 2, 0, 5]);
  });

  it('keeps an unfallen warlord’s warband, thinned like any hostile group', () => {
    expect(encounterWeights(entries, new Set(['salt-baron']), true, 50)).toEqual([2, 2, 1, 3]);
  });
});
