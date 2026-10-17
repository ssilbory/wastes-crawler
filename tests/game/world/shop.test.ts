import { describe, expect, it } from 'vitest';
import { buy } from '../../../src/game/world/shop.ts';
import { data, world } from './helpers.ts';

describe('buying small armor (docs/rules-adaptation.md, Small armor)', () => {
  it('names an item it does not stock by its id', () => {
    const w = world();
    w.purse = 1000;
    expect(buy(w, data, 'm-0', 'moon-lance', 'small')).toEqual({
      ok: false,
      reason: "moon-lance isn't sold small.",
    });
  });
});
