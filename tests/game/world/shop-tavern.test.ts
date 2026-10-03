import { describe, expect, it } from 'vitest';
import {
  addLoot,
  buy,
  exchangeLoot,
  giveItem,
  listedPrice,
  sell,
  sellPrice,
  setLocation,
  shopPrice,
} from '../../../src/game/world/shop.ts';
import {
  bench,
  catchUpXp,
  freeSlot,
  inWorld,
  recruit,
  rejoin,
} from '../../../src/game/world/tavern.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, starter, world } from './helpers.ts';

const rich = () => {
  const w = world();
  w.purse = 1000;
  return w;
};
const thugs = { enemies: [['thug-or-militia']], hostile: true, spotted: false, text: '' };

describe('the shop (SRD 3.0 prices)', () => {
  it('lists SRD prices and the surcharge past the spending threshold', () => {
    const w = rich();
    expect(listedPrice(data, 'mail-shirt')).toBe(250);
    expect(listedPrice(data, 'candle')).toBe(0.1);
    expect(() => listedPrice(data, 'club')).toThrow("club isn't for sale");
    w.towns.westhold = { spent: 1500, looted: 0, since: 0 };
    expect(shopPrice(w, data, 'crowbar')).toBe(4);
    w.towns.westhold = { spent: 3000, looted: 0, since: 0 };
    expect(shopPrice(w, data, 'crowbar')).toBe(6);
  });

  it('sells stowed, sized goods to a member, stacking repeats', () => {
    const w = rich();
    expect(buy(w, data, 'm-0', 'crowbar')).toEqual({ ok: true });
    expect(buy(w, data, 'm-0', 'crowbar')).toEqual({ ok: true });
    expect(buy(w, data, 'm-0', 'mail-shirt')).toEqual({ ok: true });
    const inv = member(w, 'Snag').character.inventory;
    expect(inv.slice(-2)).toEqual([
      { id: 'crowbar', quantity: 2, location: 'stowed' },
      { id: 'mail-shirt', quantity: 1, location: 'stowed', small: true },
    ]);
    expect(w.purse).toBe(742);
    expect(w.towns.westhold?.spent).toBe(258);
  });

  it('refuses goods too heavy to carry, or too dear', () => {
    const w = rich();
    expect(buy(w, data, 'm-3', 'rations-one-week')).toEqual({ ok: true });
    expect(buy(w, data, 'm-3', 'rations-one-week')).toEqual({
      ok: false,
      reason: "Fizzwick can't carry that much",
    });
    w.purse = 3;
    expect(buy(w, data, 'm-0', 'crowbar')).toEqual({ ok: false, reason: 'That costs 4 crowns.' });
    member(w, 'Snag').dead = true;
    expect(() => buy(w, data, 'm-0', 'crowbar')).toThrow('no living party member m-0');
  });

  it('buys back gear at half price, one at a time', () => {
    const w = rich();
    const snag = member(w, 'Snag');
    snag.character = {
      ...snag.character,
      inventory: [
        { id: 'crowbar', quantity: 2, location: 'stowed' },
        { id: 'club', quantity: 1, location: 'readied' },
      ],
    };
    expect(sellPrice(data, { id: 'crowbar', quantity: 2, location: 'stowed' })).toBe(2);
    expect(sell(w, data, 'm-0', 0)).toEqual({ ok: true });
    expect(snag.character.inventory[0]).toEqual({ id: 'crowbar', quantity: 1, location: 'stowed' });
    expect(sell(w, data, 'm-0', 0)).toEqual({ ok: true });
    expect(snag.character.inventory).toEqual([{ id: 'club', quantity: 1, location: 'readied' }]);
    expect(w.purse).toBe(1004);
    expect(sell(w, data, 'm-0', 0)).toEqual({ ok: false, reason: 'No one here will buy that.' });
    expect(() => sell(w, data, 'm-0', 5)).toThrow('no inventory line 5');
  });

  it('moves gear between worn, readied, and stowed within the limits', () => {
    const w = rich();
    buy(w, data, 'm-1', 'mail-shirt');
    const grukk = member(w, 'Grukk');
    const shirt = grukk.character.inventory.length - 1;
    expect(setLocation(w, data, 'm-1', shirt, 'worn')).toMatchObject({ ok: false });
    expect(setLocation(w, data, 'm-1', 1, 'stowed')).toEqual({ ok: true });
    expect(setLocation(w, data, 'm-1', shirt, 'worn')).toEqual({ ok: true });
    expect(grukk.character.inventory[shirt]?.location).toBe('worn');
  });

  it('hands gear from one member to another', () => {
    const w = rich();
    const snag = member(w, 'Snag');
    snag.character = {
      ...snag.character,
      inventory: [
        ...snag.character.inventory,
        { id: 'crowbar', quantity: 2, location: 'stowed' },
        { id: 'rations-one-week', quantity: 2, location: 'stowed' },
      ],
    };
    expect(giveItem(w, data, 'm-0', 5, 'm-1')).toEqual({ ok: true });
    expect(snag.character.inventory[5]?.quantity).toBe(1);
    expect(giveItem(w, data, 'm-0', 5, 'm-1')).toEqual({ ok: true });
    expect(snag.character.inventory).toHaveLength(6);
    expect(member(w, 'Grukk').character.inventory.at(-1)).toEqual({
      id: 'crowbar',
      quantity: 2,
      location: 'stowed',
    });
    expect(giveItem(w, data, 'm-0', 5, 'm-3')).toEqual({ ok: true });
    expect(giveItem(w, data, 'm-0', 5, 'm-3')).toEqual({
      ok: false,
      reason: "Fizzwick can't carry that much",
    });
    expect(() => giveItem(w, data, 'm-0', 9, 'm-1')).toThrow('no inventory line 9');
  });
});

describe('loot', () => {
  it('keeps one entry per die size, smallest first', () => {
    const w = world();
    addLoot(w, [{ count: 2, sides: 6 }]);
    addLoot(w, [
      { count: 1, sides: 4 },
      { count: 1, sides: 6 },
    ]);
    expect(w.loot).toEqual([
      { count: 1, sides: 4 },
      { count: 3, sides: 6 },
    ]);
  });

  it('rolls the dice into crowns, paying less past the loot threshold', () => {
    const w = world();
    expect(exchangeLoot(w, data)).toEqual({ rolled: 0, paid: 0 });
    addLoot(w, [{ count: 2, sides: 6 }]);
    w.rng = scriptedRng([6, 5]);
    expect(exchangeLoot(w, data)).toEqual({ rolled: 11, paid: 11 });
    expect(w).toMatchObject({ purse: 96, loot: [] });
    expect(w.log.at(-1)).toContain("The loot is worth 11 crowns; Westhold's traders pay 11.");
    w.towns.westhold = { spent: 0, looted: 750, since: 0 };
    addLoot(w, [{ count: 1, sides: 100 }]);
    w.rng = scriptedRng([75]);
    expect(exchangeLoot(w, data)).toEqual({ rolled: 75, paid: 67.5 });
    expect(w.towns.westhold?.looted).toBe(825);
  });
});

describe('the tavern', () => {
  it('benches a member, but keeps someone living in the party', () => {
    const w = world();
    expect(bench(w, data, 'm-2')).toEqual({ ok: true });
    expect(w.benched.map((m) => m.id)).toEqual(['m-2']);
    expect(w.members.map((m) => m.id)).toEqual(['m-0', 'm-1', 'm-3']);
    member(w, 'Snag').dead = true;
    member(w, 'Grukk').dead = true;
    expect(bench(w, data, 'm-3')).toEqual({
      ok: false,
      reason: 'Someone living must stay in the party.',
    });
    expect(bench(w, data, 'm-0')).toEqual({ ok: true });
    expect(() => bench(w, data, 'm-9')).toThrow('no party member m-9');
  });

  it('brings a benched member back into the first free slot', () => {
    const w = world();
    bench(w, data, 'm-0');
    expect(freeSlot(w)).toEqual({ row: 0, column: 0 });
    expect(rejoin(w, data, 'm-0')).toEqual({ ok: true });
    expect(member(w, 'Snag')).toMatchObject({ row: 0, column: 0 });
    expect(() => rejoin(w, data, 'm-0')).toThrow('no benched member m-0');
    w.encounter = thugs;
    expect(rejoin(w, data, 'm-0')).toEqual({ ok: false, reason: 'Settle the encounter first.' });
  });

  it('recruits roster characters with catch-up XP and pools their crowns', () => {
    const w = world();
    for (const m of w.members) m.character = { ...m.character, xp: 6 };
    member(w, 'Snag').character = { ...member(w, 'Snag').character, xp: 4.5 };
    bench(w, data, 'm-1');
    expect(catchUpXp(w)).toBe(4.5);
    const newcomer = { ...starter('grukk'), id: 'char-00000000feedbeef', crowns: 12 };
    member(w, 'Lirael').id = 'm-4';
    expect(inWorld(w, newcomer.id)).toBe(false);
    expect(recruit(w, data, newcomer, 'defend')).toEqual({ ok: true });
    const joined = w.members.at(-1);
    expect(joined).toMatchObject({ id: 'm-5', row: 0, column: 1, defaultAction: 'defend' });
    expect(joined?.character).toMatchObject({ xp: 4.5, crowns: 0 });
    expect(w.purse).toBe(97);
    expect(recruit(w, data, newcomer, 'auto')).toEqual({
      ok: false,
      reason: 'Grukk is already in this world.',
    });
  });

  it('holds six PCs', () => {
    const w = world();
    for (const n of [5, 6]) {
      const c = { ...starter('snag'), id: `char-0000000${n}0000000${n}` };
      expect(recruit(w, data, c, 'auto')).toEqual({ ok: true });
    }
    const extra = { ...starter('snag'), id: 'char-0000000700000007' };
    expect(recruit(w, data, extra, 'auto')).toEqual({
      ok: false,
      reason: 'A party holds 6 PCs.',
    });
    w.members = [
      ...w.members,
      ...w.members.slice(0, 2).map((m, i) => ({ ...m, row: 1, column: 2 + i })),
    ];
    expect(freeSlot(w)).toBeNull();
  });
});
