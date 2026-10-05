import { describe, expect, it } from 'vitest';
import {
  FREE_REROLLS,
  rollAttributes,
  scoresProblem,
  withSwap,
} from '../../src/game/character/attributes.ts';
import { emptyChoices, evaluateChoices } from '../../src/game/character/creation.ts';
import type { AttributeScores } from '../../src/rules/attributes.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';
import { data } from './combat/helpers.ts';

const rolled: AttributeScores = { str: 9, dex: 13, con: 8, int: 11, wis: 6, cha: 15 };

describe('rolling attributes (SRD 1.1.1)', () => {
  it('rolls 3d6 for each attribute in order', () => {
    const rng = scriptedRng([1, 2, 3, 6, 6, 6, 1, 1, 1, 4, 4, 4, 2, 2, 2, 5, 5, 5]);
    expect(rollAttributes(rng)).toEqual({ str: 6, dex: 18, con: 3, int: 12, wis: 6, cha: 15 });
  });

  it('swaps at most one score for 14', () => {
    expect(withSwap(rolled, null)).toEqual(rolled);
    expect(withSwap(rolled, 'wis')).toEqual({ ...rolled, wis: 14 });
  });
});

describe('scoresProblem', () => {
  it('holds the array to 14, 12, 11, 10, 9, 7', () => {
    const array = { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 };
    expect(scoresProblem({ kind: 'array' }, array)).toBeNull();
    expect(scoresProblem({ kind: 'array' }, { ...array, str: 18 })).toBe(
      'scores must be 14, 12, 11, 10, 9, and 7, one each',
    );
  });

  it('holds rolls to the dice, with the one 14', () => {
    const roll = { kind: 'roll' as const, rolled, swap: 'wis' as const, rerolls: 0 };
    expect(scoresProblem(roll, { ...rolled, wis: 14 })).toBeNull();
    expect(scoresProblem(roll, rolled)).toBe(
      'scores must be the ones rolled, with at most one set to 14',
    );
    expect(scoresProblem({ ...roll, swap: null }, rolled)).toBeNull();
  });

  it('opens named scores of 3 to 18 only after the free rerolls', () => {
    const manual = { kind: 'manual' as const, rerolls: FREE_REROLLS + 1 };
    expect(scoresProblem(manual, { ...rolled, str: 18, wis: 3 })).toBeNull();
    expect(scoresProblem({ ...manual, rerolls: FREE_REROLLS }, rolled)).toBe(
      'name your own scores only after the free rerolls',
    );
    for (const bad of [2, 19, 12.5])
      expect(scoresProblem(manual, { ...rolled, con: bad })).toBe(
        'each score must be a whole number from 3 to 18',
      );
  });

  it('decides the attribute step of character creation', () => {
    const base = { ...emptyChoices(), people: 'goblin' };
    const rolledOk = evaluateChoices(
      { ...base, array: rolled, attributeMethod: { kind: 'roll', rolled, swap: null, rerolls: 2 } },
      data,
    );
    expect(rolledOk.steps.attributes).toEqual({ state: 'ok' });
    const cheat = evaluateChoices(
      {
        ...base,
        array: { ...rolled, str: 18 },
        attributeMethod: { kind: 'roll', rolled, swap: null, rerolls: 2 },
      },
      data,
    );
    expect(cheat.steps.attributes).toMatchObject({ state: 'error' });
    const named = evaluateChoices(
      { ...base, array: { ...rolled, str: 18 }, attributeMethod: { kind: 'manual', rerolls: 4 } },
      data,
    );
    expect(named.steps.attributes).toEqual({ state: 'ok' });
  });
});
