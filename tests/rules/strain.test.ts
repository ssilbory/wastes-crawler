import { describe, expect, it } from 'vitest';
import {
  addStrain,
  brokenSteps,
  fullRest,
  recoverStrain,
  type StrainSource,
  type StrainState,
} from '../../src/rules/strain.ts';

const s = (strain: number, broken = false, max = 10): StrainState => ({ strain, max, broken });

describe('addStrain when not Broken', () => {
  it('breaks the character on reaching the maximum from any source', () => {
    const sources: StrainSource[] = [
      'push',
      'strain-cast',
      'healing',
      'first-aid',
      'potion',
      'condition',
      'overloaded',
      'poison',
      'monster',
    ];
    for (const source of sources) {
      expect(addStrain(s(9), 1, source), source).toEqual({ kind: 'applied', state: s(10, true) });
    }
  });

  it('applies strain below the maximum without breaking', () => {
    expect(addStrain(s(8), 1, 'push')).toEqual({ kind: 'applied', state: s(9) });
    expect(addStrain(s(2), 3, 'monster')).toEqual({ kind: 'applied', state: s(5) });
    expect(addStrain(s(0), 1, 'first-aid')).toEqual({ kind: 'applied', state: s(1) });
  });

  it('refuses voluntary and beneficial strain that would pass the maximum', () => {
    for (const source of ['push', 'strain-cast', 'healing', 'potion'] as const) {
      expect(addStrain(s(9), 2, source), source).toEqual({
        kind: 'refused',
        state: s(9),
        reason: 'over-max',
      });
    }
  });

  it('caps conditions and failed Overloaded saves at the maximum', () => {
    expect(addStrain(s(9), 3, 'condition')).toEqual({ kind: 'applied', state: s(10, true) });
    expect(addStrain(s(5), 1, 'overloaded')).toEqual({ kind: 'applied', state: s(6) });
  });

  it('knocks the character out and breaks them when poison or a monster passes the maximum', () => {
    expect(addStrain(s(9), 3, 'poison')).toEqual({ kind: 'knocked-out', state: s(10, true) });
    expect(addStrain(s(10), 1, 'monster')).toEqual({ kind: 'knocked-out', state: s(10, true) });
  });

  it('rejects negative or fractional amounts', () => {
    expect(() => addStrain(s(0), -1, 'poison')).toThrow();
    expect(() => addStrain(s(0), 0.5, 'poison')).toThrow();
  });
});

describe('addStrain when Broken', () => {
  it('refuses pushing and strain casting', () => {
    for (const source of ['push', 'strain-cast'] as const) {
      expect(addStrain(s(10, true), 1, source)).toEqual({
        kind: 'refused',
        state: s(10, true),
        reason: 'broken',
      });
    }
  });

  it('lets every other source pass the maximum', () => {
    for (const source of [
      'healing',
      'first-aid',
      'potion',
      'condition',
      'overloaded',
      'poison',
      'monster',
    ] as const) {
      expect(addStrain(s(10, true), 3, source), source).toEqual({
        kind: 'applied',
        state: s(13, true),
      });
    }
  });

  it('kills at double the maximum, not one below it', () => {
    expect(addStrain(s(18, true), 1, 'poison')).toEqual({ kind: 'applied', state: s(19, true) });
    expect(addStrain(s(19, true), 1, 'condition')).toEqual({ kind: 'dead', state: s(20, true) });
  });
});

describe('recovery', () => {
  it('recovers one point per quarter day of rest, not below zero', () => {
    expect(recoverStrain(s(5), 2, false)).toEqual(s(3));
    expect(recoverStrain(s(1), 4, false)).toEqual(s(0));
  });

  it('recovers nothing while a condition persists, and Broken stays until a full rest', () => {
    expect(recoverStrain(s(5), 4, true)).toEqual(s(5));
    expect(recoverStrain(s(10, true), 4, false)).toEqual(s(6, true));
    expect(fullRest(s(13, true))).toEqual(s(0));
  });

  it('rejects negative or fractional rest', () => {
    expect(() => recoverStrain(s(3), -2, false)).toThrow();
    expect(() => recoverStrain(s(3), 0.5, false)).toThrow();
  });

  it('gives Broken characters one step of disadvantage', () => {
    expect(brokenSteps(s(10, true))).toEqual([-1]);
    expect(brokenSteps(s(10))).toEqual([]);
  });
});
