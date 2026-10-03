import { describe, expect, it } from 'vitest';
import {
  fightXp,
  lootPayout,
  rollClimate,
  surchargedCost,
  toTenths,
} from '../../src/rules/economy.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

describe('spending threshold', () => {
  it('charges listed prices up to the threshold', () => {
    expect(surchargedCost(0, 100, 1500, 0.5)).toBe(100);
    expect(surchargedCost(1400, 100, 1500, 0.5)).toBe(100);
  });

  it('adds half the overage past it, so 20% over costs 10% more at the margin', () => {
    // The 1,800th crown is 20% over: it costs 1.1. Averaged over the 300 crowns past: +5%.
    expect(surchargedCost(1500, 300, 1500, 0.5)).toBe(315);
    expect(surchargedCost(1400, 400, 1500, 0.5)).toBe(415);
  });

  it('costs the same bought at once or piece by piece', () => {
    const once = surchargedCost(1000, 1000, 1500, 0.5);
    const split = surchargedCost(1000, 600, 1500, 0.5) + surchargedCost(1600, 400, 1500, 0.5);
    expect(split).toBeCloseTo(once, 1);
  });

  it('keeps crowns to tenths', () => {
    expect(toTenths(1.26)).toBe(1.3);
    expect(surchargedCost(300, 0.5, 300, 0.5)).toBe(0.5);
  });
});

describe('loot threshold', () => {
  it('pays in full up to the threshold', () => {
    expect(lootPayout(0, 700, 750, 2)).toBe(700);
  });

  it('pays less past it, at twice the overage, and nothing from 50% over', () => {
    // 75 crowns past a 750 threshold is 10% over: the last crown pays 80%; the 75 average 90%.
    expect(lootPayout(750, 75, 750, 2)).toBe(67.5);
    // Everything from 1,125 on pays nothing.
    expect(lootPayout(750, 1000, 750, 2)).toBe(187.5);
    expect(lootPayout(1200, 50, 750, 2)).toBe(0);
  });

  it('never drops with a zero rate', () => {
    expect(lootPayout(750, 100, 750, 0)).toBe(100);
  });
});

describe('economic climate', () => {
  it('rolls a whole percent in range', () => {
    expect(rollClimate(scriptedRng([-30]), -30, 30)).toBe(-30);
    expect(rollClimate(scriptedRng([12]), -30, 30)).toBe(12);
  });
});

describe('fight XP', () => {
  const tiers = [
    { name: 'trivial', minWinRate: 0.9, xp: 0 },
    { name: 'easy', minWinRate: 0.7, xp: 0.5 },
    { name: 'fair', minWinRate: 0.4, xp: 1 },
    { name: 'hard', minWinRate: 0.15, xp: 2 },
    { name: 'deadly', minWinRate: 0, xp: 3 },
  ];

  it('picks the first tier the win rate reaches', () => {
    expect(fightXp(tiers, 1, 2, 5).name).toBe('trivial');
    expect(fightXp(tiers, 0.9, 2, 5).name).toBe('trivial');
    expect(fightXp(tiers, 0.89, 2, 5).name).toBe('easy');
    expect(fightXp(tiers, 0.4, 2, 5).name).toBe('fair');
    expect(fightXp(tiers, 0.1, 2, 5)).toEqual(tiers[4]);
  });

  it('moves long fights one tier harder, never past the hardest', () => {
    expect(fightXp(tiers, 0.95, 5, 5).name).toBe('trivial');
    expect(fightXp(tiers, 0.95, 5.5, 5).name).toBe('easy');
    expect(fightXp(tiers, 0, 9, 5).name).toBe('deadly');
  });

  it('falls back to the hardest tier when none matches, and needs tiers', () => {
    expect(fightXp([{ name: 'only', minWinRate: 0.5, xp: 1 }], 0.2, 1, 5).name).toBe('only');
    expect(() => fightXp([], 0.5, 1, 5)).toThrow('no XP tiers');
  });
});
