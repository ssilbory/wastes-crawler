import { describe, expect, it } from 'vitest';
import { payDice } from '../../src/rules/loot-dice.ts';

describe('paying exact loot dice (docs/rules-adaptation.md, Crafting and modifying gear)', () => {
  it('takes the smallest dice that are big enough, and keeps the rest', () => {
    const loot = [
      { count: 2, sides: 10 },
      { count: 3, sides: 4 },
      { count: 4, sides: 6 },
    ];
    expect(payDice(loot, { count: 5, sides: 6 })).toEqual([
      { count: 3, sides: 4 },
      { count: 1, sides: 10 },
    ]);
    expect(payDice(loot, { count: 4, sides: 6 })).toEqual([
      { count: 3, sides: 4 },
      { count: 2, sides: 10 },
    ]);
  });

  it('refuses when short, small dice not counting', () => {
    expect(payDice([{ count: 9, sides: 4 }], { count: 1, sides: 6 })).toBeNull();
    expect(payDice([], { count: 1, sides: 6 })).toBeNull();
  });
});
