import { describe, expect, it } from 'vitest';
import {
  addStrain,
  brokenSteps,
  fullRest,
  recoverStrain,
  type StrainState,
} from '../../src/rules/strain.ts';

const s = (strain: number, broken = false, max = 10): StrainState => ({ strain, max, broken });

describe('addStrain when not Broken', () => {
  it('lets a push or strain cast reach the maximum, which breaks the character', () => {
    expect(addStrain(s(8), 1, 'push')).toEqual({ kind: 'applied', state: s(9) });
    expect(addStrain(s(7), 3, 'strain-cast')).toEqual({ kind: 'applied', state: s(10, true) });
  });

  it('refuses a push or strain cast that would pass the maximum', () => {
    expect(addStrain(s(9), 2, 'strain-cast')).toEqual({
      kind: 'refused',
      state: s(9),
      reason: 'over-max',
    });
  });

  it('refuses healing past the maximum but allows reaching it without breaking', () => {
    expect(addStrain(s(9), 2, 'healing')).toMatchObject({ kind: 'refused', reason: 'over-max' });
    expect(addStrain(s(9), 1, 'potion')).toEqual({ kind: 'applied', state: s(10) });
    expect(addStrain(s(0), 1, 'first-aid')).toEqual({ kind: 'applied', state: s(1) });
  });

  it('caps conditions at the maximum and breaks the character there', () => {
    expect(addStrain(s(5), 1, 'condition')).toEqual({ kind: 'applied', state: s(6) });
    expect(addStrain(s(10), 1, 'condition')).toEqual({ kind: 'applied', state: s(10, true) });
  });

  it('knocks the character out when poison or a monster forces strain past the maximum', () => {
    expect(addStrain(s(9), 3, 'poison')).toEqual({ kind: 'knocked-out', state: s(10) });
    expect(addStrain(s(2), 3, 'monster')).toEqual({ kind: 'applied', state: s(5) });
  });

  it('rejects negative or fractional amounts', () => {
    expect(() => addStrain(s(0), -1, 'poison')).toThrow();
    expect(() => addStrain(s(0), 0.5, 'poison')).toThrow();
  });
});

describe('addStrain when Broken', () => {
  it('refuses pushing and strain casting', () => {
    expect(addStrain(s(10, true), 1, 'push')).toEqual({
      kind: 'refused',
      state: s(10, true),
      reason: 'broken',
    });
  });

  it('lets other sources pass the maximum, and kills at double the maximum', () => {
    expect(addStrain(s(10, true), 3, 'healing')).toEqual({ kind: 'applied', state: s(13, true) });
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

  it('gives Broken characters one step of disadvantage', () => {
    expect(brokenSteps(s(10, true))).toEqual([-1]);
    expect(brokenSteps(s(10))).toEqual([]);
  });
});
