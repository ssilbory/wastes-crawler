import { describe, expect, it } from 'vitest';
import { putLine } from '../../../src/game/character/stacks.ts';
import { dropGear, giveGear, moveGear } from '../../../src/game/world/inventory.ts';
import { inventoryView, loadText } from '../../../src/render/inventory-view.ts';
import { below } from '../dungeon/helpers.ts';
import { data, encounter, member, world } from './helpers.ts';

const line = (w: ReturnType<typeof world>, name: string, id: string) =>
  member(w, name).character.inventory.findIndex((e) => e.id === id);

describe('managing gear (Phase 17)', () => {
  it('moves a whole line or part of a stack, joining like with like', () => {
    const w = world();
    const snag = member(w, 'Snag');
    const dagger = line(w, 'Snag', 'dagger');
    expect(moveGear(w, data, snag.id, dagger, 'stowed', 1)).toEqual({ ok: true });
    expect(snag.character.inventory.find((e) => e.id === 'dagger')?.location).toBe('stowed');
    // Two stowed daggers become one line; readying one splits it again.
    snag.character = {
      ...snag.character,
      inventory: putLine(snag.character.inventory, {
        id: 'dagger',
        quantity: 1,
        location: 'stowed',
      }),
    };
    const pair = line(w, 'Snag', 'dagger');
    expect(snag.character.inventory[pair]?.quantity).toBe(2);
    expect(moveGear(w, data, snag.id, pair, 'readied', 1)).toEqual({ ok: true });
    const daggers = snag.character.inventory.filter((e) => e.id === 'dagger');
    expect(daggers.map((e) => [e.location, e.quantity])).toEqual([
      ['stowed', 1],
      ['readied', 1],
    ]);
  });

  it('refuses moves that break the limits, bad counts, and a pending encounter', () => {
    const w = world();
    const snag = member(w, 'Snag');
    const dagger = line(w, 'Snag', 'dagger');
    expect(moveGear(w, data, snag.id, dagger, 'readied', 1)).toEqual({
      ok: false,
      reason: 'It is already there.',
    });
    expect(moveGear(w, data, snag.id, dagger, 'stowed', 2)).toEqual({
      ok: false,
      reason: 'Choose from 1 to 1.',
    });
    expect(moveGear(w, data, snag.id, 99, 'stowed', 1)).toEqual({
      ok: false,
      reason: 'There is no such item.',
    });
    // Wearing a dagger is no armor.
    expect(moveGear(w, data, snag.id, dagger, 'worn', 1).ok).toBe(false);
    w.encounter = encounter([['thug-or-militia']]);
    expect(moveGear(w, data, snag.id, dagger, 'stowed', 1)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('hands gear to another living member, who stows it', () => {
    const w = world();
    const [snag, grukk] = [member(w, 'Snag'), member(w, 'Grukk')];
    const dagger = line(w, 'Snag', 'dagger');
    expect(giveGear(w, data, snag.id, dagger, snag.id, 1).ok).toBe(false);
    grukk.dead = true;
    expect(giveGear(w, data, snag.id, dagger, grukk.id, 1)).toEqual({
      ok: false,
      reason: 'Choose someone else in the party.',
    });
    grukk.dead = false;
    expect(giveGear(w, data, snag.id, dagger, grukk.id, 1)).toEqual({ ok: true });
    expect(snag.character.inventory.some((e) => e.id === 'dagger')).toBe(false);
    expect(
      grukk.character.inventory.filter((e) => e.id === 'dagger').map((e) => e.location),
    ).toContain('stowed');
    expect(giveGear(w, data, snag.id, 99, grukk.id, 1).ok).toBe(false);
    expect(giveGear(w, data, grukk.id, 0, 'nobody', 1).ok).toBe(false);
  });

  it('refuses a gift the receiver can’t carry', () => {
    const w = world();
    const [snag, fizz] = [member(w, 'Snag'), member(w, 'Fizzwick')];
    const heavy = { id: 'cuirass-and-greaves', quantity: 1, location: 'stowed' as const };
    snag.character = { ...snag.character, inventory: [...snag.character.inventory, heavy] };
    fizz.character = {
      ...fizz.character,
      attributes: {
        ...fizz.character.attributes,
        base: { ...fizz.character.attributes.base, str: 3 },
      },
    };
    const r = giveGear(w, data, snag.id, snag.character.inventory.length - 1, fizz.id, 1);
    expect(r).toEqual({ ok: false, reason: "Fizzwick can't carry that much" });
  });

  it('drops gear for good, and underground every change takes a turn', () => {
    const w = below();
    const snag = member(w, 'Snag');
    const turn = (w.dungeon as NonNullable<typeof w.dungeon>).turn;
    const dagger = line(w, 'Snag', 'dagger');
    expect(dropGear(w, data, snag.id, dagger, 1)).toEqual({ ok: true });
    expect(snag.character.inventory.some((e) => e.id === 'dagger')).toBe(false);
    expect(w.log.join('\n')).toContain('Snag leaves behind Dagger.');
    expect((w.dungeon as NonNullable<typeof w.dungeon>).turn).toBe(turn + 1);
    expect(dropGear(w, data, snag.id, 99, 1).ok).toBe(false);
    snag.character = {
      ...snag.character,
      inventory: [...snag.character.inventory, { id: 'torch', quantity: 3, location: 'stowed' }],
    };
    dropGear(w, data, snag.id, snag.character.inventory.length - 1, 2);
    expect(w.log.join('\n')).toContain('Snag leaves behind Torch × 2.');
    expect(snag.character.inventory.at(-1)?.quantity).toBe(1);
    snag.character = {
      ...snag.character,
      inventory: [{ id: 'lost-thing', quantity: 1, location: 'stowed' }],
    };
    dropGear(w, data, snag.id, 0, 1);
    expect(w.log.join('\n')).toContain('Snag leaves behind lost-thing.');
  });
});

describe('the inventory view', () => {
  it('shows each line’s encumbrance, the load, who could take it, and what blocks or costs', () => {
    const w = world();
    const snag = member(w, 'Snag');
    const v = inventoryView(w, data, snag.id);
    expect(v?.name).toBe('Snag');
    expect(v?.lines.find((l) => l.name === 'Dagger')).toMatchObject({
      location: 'readied',
      quantity: 1,
      encumbrance: 1,
    });
    expect(v?.others.map((o) => o.name)).toEqual(['Grukk', 'Lirael', 'Fizzwick']);
    expect(v).toMatchObject({ blocked: null, costsTurn: false });
    expect(inventoryView(w, data, 'nobody')).toBeNull();
    w.encounter = encounter([['thug-or-militia']]);
    expect(inventoryView(w, data, snag.id)?.blocked).toBe('Settle the encounter first.');
    expect(inventoryView(below(), data, snag.id)?.costsTurn).toBe(true);
    // An item the content has lost is shown by its id, with no weight.
    snag.character = {
      ...snag.character,
      inventory: [{ id: 'lost-thing', quantity: 1, location: 'stowed' }],
    };
    expect(inventoryView(w, data, snag.id)?.lines[0]).toMatchObject({
      name: 'lost-thing',
      encumbrance: 0,
    });
  });

  it('names barding, small armor, quality, mods, and a magic bonus on each line', () => {
    const w = world();
    const snag = member(w, 'Snag');
    snag.character = {
      ...snag.character,
      inventory: [
        { id: 'pieced-armor', quantity: 1, location: 'worn', barding: true },
        { id: 'pieced-armor', quantity: 1, location: 'stowed', small: true },
        {
          id: 'spear-light',
          quantity: 1,
          location: 'readied',
          quality: 'mastercrafted',
          bonus: 1,
          mods: [
            { id: 'customized', components: [] },
            { id: 'lost-mod', components: [] },
          ],
        },
      ],
    };
    expect(inventoryView(w, data, snag.id)?.lines.map((l) => l.name)).toEqual([
      'Pieced Armor (barding)',
      'Pieced Armor (small)',
      'Spear, Light +1 (mastercrafted, Customized, lost-mod)',
    ]);
  });

  it('reads out the load against its limits', () => {
    const load = { readied: 3, stowed: 8, readiedLimit: 5, stowedLimit: 10, excess: 0 };
    expect(loadText({ ...load, state: 'ok' })).toBe('Readied 3/5, Stowed 8/10');
    expect(loadText({ ...load, excess: 2, state: 'overloaded' })).toBe(
      'Readied 3/5, Stowed 8/10. Overloaded by 2',
    );
    expect(loadText({ ...load, excess: 9, state: 'too-heavy' })).toBe(
      'Readied 3/5, Stowed 8/10. Too heavy to move by 9',
    );
  });
});
