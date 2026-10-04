import { describe, expect, it } from 'vitest';
import { distance, hexKey, neighbors, parseHexKey } from '../../src/rules/hex.ts';
import {
  encounterCheck,
  isDark,
  isHarshNight,
  moveCost,
  QUARTERS,
} from '../../src/rules/overland.ts';
import { reactionFor, reactionRoll } from '../../src/rules/reaction.ts';
import { stepDie, useResource } from '../../src/rules/resource-die.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

describe('hex grid (odd-q offset)', () => {
  it('finds neighbors for even and odd columns', () => {
    expect(neighbors({ col: 2, row: 2 }).map(hexKey)).toEqual([
      '3,1',
      '3,2',
      '2,3',
      '1,2',
      '1,1',
      '2,1',
    ]);
    expect(neighbors({ col: 3, row: 2 }).map(hexKey)).toEqual([
      '4,2',
      '4,3',
      '3,3',
      '2,3',
      '2,2',
      '3,1',
    ]);
  });

  it('measures distance in hexes, and every neighbor is one away', () => {
    for (const h of [
      { col: 2, row: 2 },
      { col: 3, row: 2 },
    ])
      for (const n of neighbors(h)) expect(distance(h, n)).toBe(1);
    expect(distance({ col: 0, row: 0 }, { col: 3, row: 0 })).toBe(3);
    expect(distance({ col: 0, row: 0 }, { col: 0, row: 4 })).toBe(4);
    expect(distance({ col: 1, row: 1 }, { col: 1, row: 1 })).toBe(0);
  });

  it('round-trips hex keys and rejects bad ones', () => {
    expect(parseHexKey('4,-2')).toEqual({ col: 4, row: -2 });
    expect(() => parseHexKey('4')).toThrow('invalid hex key 4');
    expect(() => parseHexKey('a,b')).toThrow('invalid hex key a,b');
  });
});

describe('resource dice (house rule)', () => {
  it('steps between empty and d12', () => {
    expect(stepDie(8, 1)).toBe(10);
    expect(stepDie(12, 2)).toBe(12);
    expect(stepDie(4, -1)).toBe(0);
    expect(stepDie(0, -1)).toBe(0);
    expect(stepDie(0, 2)).toBe(6);
  });

  it('steps down on a 1 or 2, and has nothing to give once gone', () => {
    expect(useResource(scriptedRng([3]), 8)).toEqual({ available: true, roll: 3, die: 8 });
    expect(useResource(scriptedRng([2]), 8)).toEqual({ available: true, roll: 2, die: 6 });
    expect(useResource(scriptedRng([1]), 4)).toEqual({ available: true, roll: 1, die: 0 });
    expect(useResource(scriptedRng([]), 0)).toEqual({ available: false, roll: null, die: 0 });
  });
});

describe('reaction rolls (SRD 5.2.1)', () => {
  it('reads the 2d6 table', () => {
    expect([2, 3, 5, 6, 8, 9, 11, 12, 14].map(reactionFor)).toEqual([
      'aggressive',
      'unfriendly',
      'unfriendly',
      'expected',
      'expected',
      'friendly',
      'friendly',
      'helpful',
      'helpful',
    ]);
    expect(reactionRoll(scriptedRng([4, 4]), 1)).toEqual({ total: 9, reaction: 'friendly' });
  });
});

describe('overland travel', () => {
  it('costs 1 for open hexes and roads, 2 for difficult, and blocks the impassable', () => {
    expect(moveCost('open', false)).toBe(1);
    expect(moveCost('difficult', false)).toBe(2);
    expect(moveCost('difficult', true)).toBe(1);
    expect(moveCost('impassable', true)).toBeNull();
  });

  it('darkens nights, and winter mornings and evenings', () => {
    expect(QUARTERS.map((q) => isDark(q, 'summer'))).toEqual([false, false, false, true]);
    expect(QUARTERS.map((q) => isDark(q, 'winter'))).toEqual([true, false, true, true]);
  });

  it('makes harsh terrain and winter nights harsh', () => {
    expect(isHarshNight(true, 'summer')).toBe(true);
    expect(isHarshNight(false, 'winter')).toBe(true);
    expect(isHarshNight(false, 'autumn')).toBe(false);
  });

  it('finds an encounter on a 1', () => {
    expect(encounterCheck(scriptedRng([1]), 16)).toBe(true);
    expect(encounterCheck(scriptedRng([2]), 16)).toBe(false);
  });
});
