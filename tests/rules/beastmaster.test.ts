import { describe, expect, it } from 'vitest';
import {
  feralAc,
  maxCompanionHitDice,
  sharedHitDice,
  sharedHitFloor,
  swiftHealingDice,
  weaponryBonus,
} from '../../src/rules/beastmaster.ts';

describe('the Beastmaster’s numbers (1.5.4)', () => {
  it('binds companions of up to the level plus one in hit dice', () => {
    expect(maxCompanionHitDice(1)).toBe(2);
    expect(maxCompanionHitDice(7)).toBe(8);
  });

  it('gives Feral Toughness an AC of 13 plus half the level, rounded up', () => {
    expect(feralAc(1)).toBe(14);
    expect(feralAc(2)).toBe(14);
    expect(feralAc(3)).toBe(15);
    expect(feralAc(10)).toBe(18);
  });

  it('raises Natural Weaponry at levels 3, 6, and 9 only', () => {
    expect([1, 2, 3, 5, 6, 8, 9, 12].map(weaponryBonus)).toEqual([0, 0, 1, 1, 2, 2, 3, 3]);
  });

  it('lifts a companion to the level in hit dice, never lowering it', () => {
    expect(sharedHitDice(2, 7)).toBe(7);
    expect(sharedHitDice(6, 3)).toBe(6);
  });

  it('floors the hit bonus at half the hit dice, rounded up', () => {
    expect(sharedHitFloor(7)).toBe(4);
    expect(sharedHitFloor(1)).toBe(1);
  });

  it('heals 1d6 per level, at least one die', () => {
    expect(swiftHealingDice(4)).toEqual({ count: 4, sides: 6, modifier: 0 });
    expect(swiftHealingDice(0).count).toBe(1);
  });
});
