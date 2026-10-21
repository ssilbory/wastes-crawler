import { describe, expect, it } from 'vitest';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { buyable, findItem } from '../../../src/game/character/items.ts';
import { cannotDrink, carried, drink, potionOf } from '../../../src/game/world/potions.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { potionView, usable } from '../../../src/render/potion-view.ts';
import { data, encounter, member, world } from './helpers.ts';

function give(m: Member, ...lines: InventoryEntry[]): void {
  m.character = { ...m.character, inventory: [...m.character.inventory, ...lines] };
}
const stowed = (id: string, quantity = 1): InventoryEntry => ({ id, quantity, location: 'stowed' });
const hurtTo = (m: Member, hp: number) => {
  m.character = { ...m.character, hp: { ...m.character.hp, current: hp } };
};
const setStrain = (m: Member, value: number, broken = false) => {
  m.character = { ...m.character, strain: { value, broken } };
};
const healing = () => potionOf(data, 'healing-draught') as NonNullable<ReturnType<typeof potionOf>>;

describe('potions are items (docs/rules-adaptation.md, Potions)', () => {
  it('are in the catalog, priced at their brewing cost, but not in the town shop', () => {
    expect(findItem(data, 'healing-draught')?.kind).toBe('potion');
    expect(potionOf(data, 'healing-draught')?.cost).toEqual({ amount: 10, unit: 'sp' });
    expect(potionOf(data, 'dagger')).toBeNull();
    expect(potionOf(data, 'nothing')).toBeNull();
    expect(buyable(data).some((i) => i.kind === 'potion')).toBe(false);
  });

  it('counts what each member carries, across lines', () => {
    const w = world();
    const snag = member(w, 'Snag');
    give(snag, stowed('healing-draught', 2), { ...stowed('healing-draught'), location: 'readied' });
    expect(carried(data, snag).map((c) => [c.potion.id, c.count])).toEqual([
      ['healing-draught', 3],
    ]);
  });
});

describe('drinking out of fights', () => {
  it('heals the hurt for the dice and 1 System Strain, from the holder’s pack', () => {
    const w = world([4, 5]);
    const snag = member(w, 'Snag');
    const grukk = member(w, 'Grukk');
    give(snag, stowed('healing-draught', 2));
    hurtTo(grukk, 1);
    setStrain(grukk, 0);
    expect(drink(w, data, snag.id, 'healing-draught', grukk.id)).toEqual({ ok: true });
    expect(grukk.character.hp.current).toBe(Math.min(grukk.character.hp.max, 10));
    expect(grukk.character.strain.value).toBe(1);
    expect(carried(data, snag)[0]?.count).toBe(1);
    expect(w.log.at(-1)).toContain('Snag gives Grukk a Healing Draught: 9 HP.');
  });

  it('refuses the unhurt, the strain past the maximum, and a missing potion', () => {
    const w = world();
    const snag = member(w, 'Snag');
    expect(drink(w, data, snag.id, 'healing-draught', snag.id)).toEqual({
      ok: false,
      reason: 'Snag carries no Healing Draught.',
    });
    give(snag, stowed('healing-draught'));
    expect(drink(w, data, snag.id, 'healing-draught', snag.id)).toEqual({
      ok: false,
      reason: 'Snag is unhurt.',
    });
    hurtTo(snag, 1);
    setStrain(snag, 99);
    expect(cannotDrink(w, data, healing(), snag)).toBe("Snag can't bear the strain.");
    expect(() => drink(w, data, snag.id, 'dagger', snag.id)).toThrow();
    expect(() => drink(w, data, snag.id, 'healing-draught', 'nobody')).toThrow();
  });

  it('kills a Broken drinker pushed to twice their maximum strain', () => {
    const w = world([1, 1]);
    const snag = member(w, 'Snag');
    give(snag, stowed('healing-draught'));
    hurtTo(snag, 1);
    const max = snag.character.attributes.base.con;
    setStrain(snag, max * 2 - 1, true);
    expect(drink(w, data, snag.id, 'healing-draught', snag.id)).toEqual({ ok: true });
    expect(snag.dead).toBe(true);
    expect(w.log.at(-1)).toContain('body gives out under the strain');
  });

  it('needs a conscious holder and no encounter', () => {
    const w = world();
    const snag = member(w, 'Snag');
    give(snag, stowed('healing-draught'));
    hurtTo(snag, 0);
    expect(drink(w, data, snag.id, 'healing-draught', snag.id).ok).toBe(false);
    hurtTo(snag, 1);
    w.encounter = encounter([['thug-or-militia']]);
    expect(drink(w, data, snag.id, 'healing-draught', snag.id)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('eases strain with a tonic, even while Sleepless', () => {
    const w = world();
    const snag = member(w, 'Snag');
    give(snag, stowed('restorative-tonic', 2));
    setStrain(snag, 0);
    expect(drink(w, data, snag.id, 'restorative-tonic', snag.id).ok).toBe(false);
    setStrain(snag, 2);
    snag.sleepless = true;
    expect(drink(w, data, snag.id, 'restorative-tonic', snag.id)).toEqual({ ok: true });
    expect(snag.character.strain.value).toBe(1);
  });

  it('lifts Sleepless and Cold with a waking tonic', () => {
    const w = world();
    const snag = member(w, 'Snag');
    give(snag, stowed('waking-tonic'));
    expect(drink(w, data, snag.id, 'waking-tonic', snag.id)).toEqual({
      ok: false,
      reason: 'Snag is neither Sleepless nor Cold.',
    });
    snag.cold = true;
    snag.sleepless = true;
    expect(drink(w, data, snag.id, 'waking-tonic', snag.id)).toEqual({ ok: true });
    expect([snag.sleepless, snag.cold]).toEqual([false, false]);
  });

  it('keeps Oil of Edge for fights', () => {
    const w = world();
    const snag = member(w, 'Snag');
    give(snag, stowed('oil-of-edge'));
    expect(drink(w, data, snag.id, 'oil-of-edge', snag.id)).toEqual({
      ok: false,
      reason: 'Oil of Edge is for fights.',
    });
  });

  it('slips the party away with a Shadow Draught, only from a group that hasn’t spotted it', () => {
    const w = world();
    const snag = member(w, 'Snag');
    give(snag, stowed('shadow-draught', 2));
    expect(drink(w, data, snag.id, 'shadow-draught', snag.id)).toEqual({
      ok: false,
      reason: 'There is no one to slip away from.',
    });
    w.encounter = encounter([['thug-or-militia']], { spotted: true });
    expect(drink(w, data, snag.id, 'shadow-draught', snag.id).ok).toBe(false);
    w.encounter = encounter([['thug-or-militia']]);
    expect(drink(w, data, snag.id, 'shadow-draught', snag.id)).toEqual({ ok: true });
    expect(w.encounter).toBeNull();
    expect(w.log.join('\n')).toContain('passes round a Shadow Draught');
  });
});

describe('the potion panel’s view', () => {
  it('lists each holder’s potions and who each can go to now', () => {
    const w: World = world();
    const snag = member(w, 'Snag');
    const grukk = member(w, 'Grukk');
    give(snag, stowed('healing-draught'), stowed('shadow-draught'));
    hurtTo(grukk, 1);
    const view = potionView(w, data);
    expect(view.map((l) => [l.holder.name, l.potion.name, l.targets.map((t) => t.name)])).toEqual([
      ['Snag', 'Healing Draught', ['Grukk']],
      ['Snag', 'Shadow Draught', []],
    ]);
    expect(usable(view).map((l) => l.potion.id)).toEqual(['healing-draught']);
    w.encounter = encounter([['thug-or-militia']]);
    expect(usable(potionView(w, data)).map((l) => [l.potion.id, l.targets[0]?.name])).toEqual([
      ['shadow-draught', 'Snag'],
    ]);
  });
});
