import { describe, expect, it } from 'vitest';
import { payDice } from '../../src/rules/loot-dice.ts';

describe('paying for mods in loot dice (docs/rules-adaptation.md, Crafting and modifying gear)', () => {
  const loot = [
    { count: 2, sides: 10 },
    { count: 3, sides: 4 },
    { count: 4, sides: 6 },
  ];

  it('takes the smallest dice that are big enough, and keeps the rest', () => {
    expect(payDice(loot, { count: 5, sides: 6 })).toEqual({
      left: [
        { count: 3, sides: 4 },
        { count: 1, sides: 10 },
      ],
      short: 0,
      crowns: 0,
    });
  });

  it('prices each die short at its highest face, small dice not counting', () => {
    expect(payDice([{ count: 9, sides: 4 }], { count: 2, sides: 12 })).toEqual({
      left: [{ count: 9, sides: 4 }],
      short: 2,
      crowns: 24,
    });
    expect(payDice(loot, { count: 8, sides: 6 })).toMatchObject({ short: 2, crowns: 12 });
  });

  it('can leave the dice alone and price the whole cost in crowns', () => {
    expect(payDice(loot, { count: 6, sides: 6 }, false)).toEqual({
      left: [
        { count: 3, sides: 4 },
        { count: 4, sides: 6 },
        { count: 2, sides: 10 },
      ],
      short: 6,
      crowns: 36,
    });
  });
});
