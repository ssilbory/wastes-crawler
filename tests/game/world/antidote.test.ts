import { describe, expect, it } from 'vitest';
import type { PendingEncounter } from '../../../src/data/schemas/index.ts';
import { findItem } from '../../../src/game/character/items.ts';
import { antidoteGivers, giveAntidote } from '../../../src/game/world/antidote.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { antidoteView } from '../../../src/render/antidote-view.ts';
import { data, member, world } from './helpers.ts';

const fail = (reason: string) => ({ ok: false, reason });

/** Lirael carrying `doses` antidotes, and Snag Poisoned. */
function poisoned(doses: number): { w: World; lirael: Member; snag: Member } {
  const w = world();
  const lirael = member(w, 'Lirael');
  if (doses > 0)
    lirael.character = {
      ...lirael.character,
      inventory: [
        ...lirael.character.inventory,
        { id: 'antidote', quantity: doses, location: 'stowed' },
      ],
    };
  const snag = member(w, 'Snag');
  snag.poisoned = true;
  return { w, lirael, snag };
}

const doses = (m: Member) =>
  m.character.inventory.filter((e) => e.id === 'antidote').reduce((n, e) => n + e.quantity, 0);

describe('antidotes', () => {
  it('are sold like any gear', () => {
    expect(findItem(data, 'antidote')).toMatchObject({ kind: 'gear', cost: { amount: 25 } });
  });

  it('neutralize a poison, one dose each', () => {
    const { w, lirael, snag } = poisoned(2);
    expect(antidoteGivers(w, data)).toEqual([lirael]);
    expect(giveAntidote(w, data, lirael.id, snag.id)).toEqual({ ok: true });
    expect([snag.poisoned, doses(lirael)]).toEqual([false, 1]);
    expect(w.log.at(-1)).toMatch(/Lirael gives Snag an antidote; the poison is gone\./);
    const grukk = member(w, 'Grukk');
    grukk.poisoned = true;
    giveAntidote(w, data, lirael.id, grukk.id);
    expect(doses(lirael)).toBe(0);
    expect(lirael.character.inventory.some((e) => e.id === 'antidote')).toBe(false);
  });

  it('need a conscious giver with a dose, and someone Poisoned, outside an encounter', () => {
    const { w, lirael, snag } = poisoned(0);
    expect(giveAntidote(w, data, lirael.id, snag.id)).toEqual(fail('No one able has an antidote.'));
    const dosed = poisoned(1);
    expect(giveAntidote(dosed.w, data, dosed.lirael.id, member(dosed.w, 'Grukk').id)).toEqual(
      fail('Choose someone who is Poisoned.'),
    );
    dosed.lirael.character = {
      ...dosed.lirael.character,
      hp: { ...dosed.lirael.character.hp, current: 0 },
    };
    expect(antidoteGivers(dosed.w, data)).toEqual([]);
    const busy = poisoned(1);
    busy.w.encounter = {} as PendingEncounter;
    expect(giveAntidote(busy.w, data, busy.lirael.id, busy.snag.id)).toEqual(
      fail('Settle the encounter first.'),
    );
    expect(doses(busy.lirael)).toBe(1);
  });

  it('are a level-2 Poisoner’s own remedy, needing no dose', () => {
    const { w, lirael, snag } = poisoned(0);
    lirael.character = { ...lirael.character, foci: [{ id: 'poisoner', level: 2 }] };
    expect(antidoteView(w, data)).toEqual({
      givers: [{ id: lirael.id, name: 'Lirael', doses: null }],
      poisoned: [{ id: snag.id, name: 'Snag' }],
    });
    expect(giveAntidote(w, data, lirael.id, snag.id)).toEqual({ ok: true });
    expect(w.log.at(-1)).toMatch(/a remedy of their own/);
    lirael.character = { ...lirael.character, foci: [{ id: 'poisoner', level: 1 }] };
    expect(antidoteGivers(w, data)).toEqual([]);
  });

  it('show on the panel only with a giver and someone Poisoned', () => {
    const { w, lirael, snag } = poisoned(3);
    expect(antidoteView(w, data)).toEqual({
      givers: [{ id: lirael.id, name: 'Lirael', doses: 3 }],
      poisoned: [{ id: snag.id, name: 'Snag' }],
    });
    snag.poisoned = false;
    expect(antidoteView(w, data)).toBeNull();
    expect(antidoteView(poisoned(0).w, data)).toBeNull();
  });
});
