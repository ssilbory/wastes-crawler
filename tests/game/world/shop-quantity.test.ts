import { describe, expect, it } from 'vitest';
import { lineLabel } from '../../../src/game/character/items.ts';
import { buy, sell } from '../../../src/game/world/shop.ts';
import { entryText } from '../../../src/render/town-view.ts';
import { data, fullShop, member, world } from './helpers.ts';

const torches = (name: string, w: ReturnType<typeof world>) =>
  member(w, name).character.inventory.find((e) => e.id === 'torch')?.quantity ?? 0;

describe('buying and selling more than one at a time', () => {
  it('buys a number of one item, each at the going price', () => {
    const w = world();
    w.purse = 10;
    expect(buy(w, fullShop, 'm-0', 'torch', undefined, 5)).toEqual({ ok: true });
    expect(torches('Snag', w)).toBe(5);
    expect(w.purse).toBe(9);
  });

  it('keeps what it could buy when it runs short, and says why', () => {
    const w = world();
    w.purse = 0.5;
    expect(buy(w, fullShop, 'm-0', 'torch', undefined, 4)).toEqual({ ok: true });
    expect(torches('Snag', w)).toBe(2);
    expect(w.log.at(-1)).toMatch(/Only 2 of 4: That costs 0\.2 crowns\.$/);
    w.purse = 0;
    expect(buy(w, fullShop, 'm-0', 'torch', undefined, 2)).toEqual({
      ok: false,
      reason: 'That costs 0.2 crowns.',
    });
  });

  it('asks for a whole number of at least one', () => {
    const w = world();
    for (const n of [0, 1.5])
      expect(buy(w, fullShop, 'm-0', 'torch', undefined, n)).toEqual({
        ok: false,
        reason: 'Choose how many.',
      });
  });

  it('sells part of a stack, never past it', () => {
    const w = world();
    const snag = member(w, 'Snag');
    snag.character = {
      ...snag.character,
      inventory: [
        { id: 'crowbar', quantity: 3, location: 'stowed' },
        { id: 'dagger', quantity: 1, location: 'readied' },
      ],
    };
    const purse = w.purse;
    expect(sell(w, data, 'm-0', 0, 4)).toEqual({ ok: false, reason: 'Choose from 1 to 3.' });
    expect(sell(w, data, 'm-0', 0, 2)).toEqual({ ok: true });
    expect(snag.character.inventory[0]).toEqual({ id: 'crowbar', quantity: 1, location: 'stowed' });
    expect(w.purse).toBe(purse + 4);
    expect(sell(w, data, 'm-0', 0, 1)).toEqual({ ok: true });
    expect(snag.character.inventory).toEqual([{ id: 'dagger', quantity: 1, location: 'readied' }]);
  });
});

describe("a used quiver's die", () => {
  it('shows on the line', () => {
    const quiver = { id: 'arrows-20', quantity: 1, location: 'stowed' as const, die: 8 as const };
    expect(lineLabel(data, quiver)).toBe('Arrows, 20 (d8 left)');
    expect(entryText(data, quiver)).toBe('Arrows, 20 (d8 left, stowed)');
  });
});
