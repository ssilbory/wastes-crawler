import { describe, expect, it } from 'vitest';
import { canCastIn, effortMaximum, strainCastCost } from '../../src/rules/magic.ts';

describe('effortMaximum', () => {
  it('is 1 + skill + attribute for full casters', () => {
    const full = { offset: 1, floorOne: false };
    expect(effortMaximum({ ...full, skill: 0, attributeModifier: 1 })).toBe(2);
    expect(effortMaximum({ ...full, skill: 1, attributeModifier: 2 })).toBe(4);
    expect(effortMaximum({ ...full, skill: 0, attributeModifier: -1 })).toBe(0);
  });

  it('is one lower for partial casters, and skill plus attribute for arts alone, never below 1', () => {
    const partial = { offset: 0, floorOne: true };
    expect(effortMaximum({ ...partial, skill: 1, attributeModifier: 1 })).toBe(2);
    expect(effortMaximum({ ...partial, skill: 0, attributeModifier: -1 })).toBe(1);
    expect(effortMaximum({ ...partial, skill: 0, attributeModifier: 0 })).toBe(1);
  });
});

describe('strainCastCost', () => {
  it('costs the spell level, for levels 1 to 5', () => {
    expect(strainCastCost(1)).toBe(1);
    expect(strainCastCost(5)).toBe(5);
    expect(() => strainCastCost(0)).toThrow();
    expect(() => strainCastCost(6)).toThrow();
    expect(() => strainCastCost(1.5)).toThrow();
  });
});

describe('canCastIn', () => {
  it('refuses any armor or shield without Armored Magic', () => {
    expect(canCastIn([], false, null)).toBe(true);
    expect(canCastIn([0], false, null)).toBe(false);
    expect(canCastIn([], true, null)).toBe(false);
  });

  it('allows light armor and shields at Armored Magic 1, any armor at 2', () => {
    const one = { maxEncumbrance: 2, shields: true };
    expect(canCastIn([2], true, one)).toBe(true);
    expect(canCastIn([3], false, one)).toBe(false);
    expect(canCastIn([3, 4], false, { maxEncumbrance: null, shields: true })).toBe(true);
    expect(canCastIn([], true, { maxEncumbrance: 2, shields: false })).toBe(false);
  });
});
