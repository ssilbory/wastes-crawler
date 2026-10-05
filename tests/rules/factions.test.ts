import { describe, expect, it } from 'vitest';
import {
  assetRepair,
  attackerWins,
  bloodTarget,
  factionIncome,
  factionMaxHp,
  factionRepair,
  raiseCost,
  repairCost,
  rootOutDifficulty,
} from '../../src/rules/factions.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

describe('faction attribute checks (6.4.0)', () => {
  it('adds the rating to a d10, and ties go to the defender', () => {
    expect(attackerWins(scriptedRng([5, 4]), { rating: 3, dice: 1 }, { rating: 3, dice: 1 })).toBe(
      true,
    );
    expect(attackerWins(scriptedRng([4, 5]), { rating: 3, dice: 1 }, { rating: 2, dice: 1 })).toBe(
      false,
    );
    expect(attackerWins(scriptedRng([1, 10]), { rating: 8, dice: 1 }, { rating: 1, dice: 1 })).toBe(
      false,
    );
  });

  it('keeps the best die when a tag adds one', () => {
    // Attacker rolls 2 and 9, keeping 9; defender 7.
    expect(
      attackerWins(scriptedRng([2, 9, 7]), { rating: 1, dice: 2 }, { rating: 2, dice: 1 }),
    ).toBe(true);
    // Defender rolls 3 and 8, keeping 8.
    expect(
      attackerWins(scriptedRng([6, 3, 8]), { rating: 2, dice: 1 }, { rating: 1, dice: 2 }),
    ).toBe(false);
  });
});

describe('faction statistics (6.2.0, 6.7.0)', () => {
  it('earns half Wealth plus a quarter of Force and Cunning, rounded up', () => {
    expect(factionIncome({ force: 6, cunning: 2, wealth: 4 })).toBe(4);
    expect(factionIncome({ force: 1, cunning: 1, wealth: 1 })).toBe(1);
    expect(factionIncome({ force: 1, cunning: 2, wealth: 1 })).toBe(2);
    expect(factionIncome({ force: 3, cunning: 1, wealth: 4 })).toBe(3);
  });

  it('sums hit points from the table', () => {
    // The SRD's example: Force 3, Wealth 5, Cunning 2 is 4 + 9 + 2.
    expect(factionMaxHp({ force: 3, cunning: 2, wealth: 5 })).toBe(15);
    expect(factionMaxHp({ force: 8, cunning: 8, wealth: 8 })).toBe(60);
    expect(factionMaxHp({ force: 1, cunning: 1, wealth: 1 })).toBe(3);
    expect(() => factionMaxHp({ force: 0, cunning: 1, wealth: 1 })).toThrow(
      'invalid faction rating 0',
    );
    expect(() => factionMaxHp({ force: 9, cunning: 1, wealth: 1 })).toThrow();
    expect(() => factionMaxHp({ force: 2.5, cunning: 1, wealth: 1 })).toThrow();
  });

  it('costs experience to raise a rating, one step at a time', () => {
    expect(raiseCost(1)).toBe(2);
    expect(raiseCost(5)).toBe(12);
    expect(raiseCost(7)).toBe(20);
    expect(raiseCost(8)).toBeNull();
  });
});

describe('repair and goals (6.6.0, 6.7.0)', () => {
  it('repairs assets by half the attribute and the faction by its extremes', () => {
    expect(assetRepair(5)).toBe(3);
    expect(assetRepair(4)).toBe(2);
    expect([1, 2, 3].map(repairCost)).toEqual([1, 2, 3]);
    // The SRD's example: Force 5, Wealth 2, Cunning 4 heals 4.
    expect(factionRepair({ force: 5, cunning: 4, wealth: 2 })).toBe(4);
  });

  it('sets goal sizes from the ratings', () => {
    expect(rootOutDifficulty({ force: 3, cunning: 1, wealth: 4 })).toBe(2);
    expect(rootOutDifficulty({ force: 8, cunning: 8, wealth: 8 })).toBe(4);
    expect(bloodTarget({ force: 6, cunning: 2, wealth: 4 })).toBe(12);
  });
});
