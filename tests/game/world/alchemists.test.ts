import { describe, expect, it } from 'vitest';
import { alchemyReferenceErrors } from '../../../src/data/alchemy-check.ts';
import {
  alchemistHere,
  alchemistState,
  buyPotion,
  collectBrew,
  orderBrew,
  stockListed,
  visitAlchemist,
} from '../../../src/game/world/alchemists.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from './helpers.ts';

const vell = data.content.alchemy.alchemists[0] as (typeof data.content.alchemy.alchemists)[0];
const count = (m: Member, id: string) =>
  m.character.inventory.filter((e) => e.id === id).reduce((n, e) => n + e.quantity, 0);

/** The starters in Rubblegate, called on Mother Vell: 2 healing draughts and 1 greater healing. */
function atVell(faces: number[] = []): World {
  const w = world([2, 1, 2, 7, 1, ...faces]);
  w.purse = 500;
  expect(visitAlchemist(w, data)).toEqual({ ok: true });
  return w;
}

describe('alchemists (docs/rules-adaptation.md, Potions: Alchemists)', () => {
  it('work in towns, and draw their month’s stock by recipe weight when called on', () => {
    const w = world([]);
    expect(alchemistHere(w, data)?.name).toBe('Mother Vell');
    expect(alchemistState(w, data, vell)).toBeNull();
    const at = atVell();
    expect(alchemistState(at, data, vell)).toEqual({
      since: 0,
      stock: { 'healing-draught': 2, 'greater-healing': 1 },
    });
    expect(visitAlchemist(at, data)).toEqual({ ok: true });
    at.day += 30;
    expect(alchemistState(at, data, vell)).toBeNull();
    at.position = { col: 17, row: 4 };
    expect(alchemistHere(at, data)).toBeUndefined();
    expect(visitAlchemist(at, data)).toEqual({
      ok: false,
      reason: 'No alchemist works in Grimcairn.',
    });
    expect(buyPotion(at, data, 'healing-draught', member(at, 'Snag').id)).toEqual({
      ok: false,
      reason: 'No alchemist works in Grimcairn.',
    });
  });

  it('sell ready-made doses at four times the brewing cost', () => {
    const w = atVell();
    const snag = member(w, 'Snag');
    expect(stockListed(data, 'healing-draught')).toBe(40);
    expect(buyPotion(w, data, 'healing-draught', snag.id)).toEqual({ ok: true });
    expect(buyPotion(w, data, 'healing-draught', snag.id)).toEqual({ ok: true });
    expect(count(snag, 'healing-draught')).toBe(2);
    expect(w.purse).toBeLessThanOrEqual(420);
    expect(w.alchemists[vell.id]?.stock).toEqual({ 'greater-healing': 1 });
    expect(buyPotion(w, data, 'healing-draught', snag.id)).toEqual({
      ok: false,
      reason: 'Mother Vell has no Healing Draught left.',
    });
    w.purse = 0;
    expect(buyPotion(w, data, 'greater-healing', snag.id).ok).toBe(false);
    expect(() => buyPotion(atVell(), data, 'healing-draught', 'nobody')).toThrow();
  });

  it('must be called on first, and not in an encounter', () => {
    const w = world([]);
    expect(buyPotion(w, data, 'healing-draught', member(w, 'Snag').id)).toEqual({
      ok: false,
      reason: 'Call on Mother Vell first.',
    });
    expect(collectBrew(w, data, 0, member(w, 'Snag').id)).toEqual({
      ok: false,
      reason: 'Call on Mother Vell first.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(orderBrew(w, data, 'healing-draught', 1)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('brew to order at the brewing cost a dose, collected here in a week', () => {
    const w = atVell();
    const snag = member(w, 'Snag');
    expect(orderBrew(w, data, 'waking-tonic', 3)).toEqual({ ok: true });
    expect(w.purse).toBeLessThanOrEqual(470);
    expect(w.brewOrders).toEqual([
      { alchemist: vell.id, item: 'waking-tonic', doses: 3, readyDay: 7 },
    ]);
    expect(collectBrew(w, data, 0, snag.id)).toEqual({
      ok: false,
      reason: 'Not ready for 7 days.',
    });
    w.day = 7;
    w.alchemists[vell.id] = { since: 7, stock: {} };
    expect(collectBrew(w, data, 0, snag.id)).toEqual({ ok: true });
    expect(count(snag, 'waking-tonic')).toBe(3);
    expect(w.brewOrders).toEqual([]);
    expect(() => collectBrew(w, data, 0, snag.id)).toThrow();
    // An order placed with another town's alchemist is collected there.
    w.brewOrders = [
      { alchemist: 'alchemist-eastmarch', item: 'healing-draught', doses: 1, readyDay: 0 },
    ];
    expect(() => collectBrew(w, data, 0, snag.id)).toThrow();
    w.brewOrders = [];
    expect(() => orderBrew(w, data, 'oil-of-edge', 1)).toThrow();
    expect(() => orderBrew(w, data, 'waking-tonic', 0)).toThrow();
    w.purse = 0;
    expect(orderBrew(w, data, 'waking-tonic', 1).ok).toBe(false);
  });

  it('keep their state and orders in the save, and old saves start with none', () => {
    const w = world();
    w.purse = 100;
    visitAlchemist(w, data);
    orderBrew(w, data, 'healing-draught', 1);
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.alchemists).toEqual(w.alchemists);
    expect(back.world.brewOrders).toEqual(w.brewOrders);
    const up = WORLD_MIGRATIONS[39] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 39 })).toEqual({
      schemaVersion: 40,
      alchemists: {},
      brewOrders: [],
    });
  });
});

describe('alchemy content checks', () => {
  it('passes for the shipped content', () => {
    expect(alchemyReferenceErrors(data.srd, data.content)).toEqual([]);
  });

  it('catches unknown skills, clashing ids, missing recipes, and misplaced alchemists', () => {
    const a = data.content.alchemy;
    const potion = a.potions[0] as (typeof a.potions)[0];
    const broken = {
      ...data.content,
      alchemy: {
        ...a,
        skill: 'brewing',
        batches: [{ doses: 2, difficulty: 1 }],
        potions: [...a.potions, { ...potion, id: 'dagger' }, { ...potion, id: 'lonely' }],
        recipes: [...a.recipes, { item: 'nothing', difficulty: 8, weight: 1 }, a.recipes[0]],
        alchemists: [
          { ...vell, wares: ['dagger-x'] },
          { ...vell, id: 'twin' },
          { ...vell, id: 'nowhere', town: 'nowhere' },
          { ...vell, id: 'village', town: 'highcairn' },
        ],
      },
    } as typeof data.content;
    expect(alchemyReferenceErrors(data.srd, broken)).toEqual([
      'alchemy: unknown skill brewing',
      'alchemy/potions/dagger: id taken',
      'alchemy/recipes: unknown item nothing',
      'alchemy/recipes: healing-draught twice',
      'alchemy/potions/dagger: no recipe',
      'alchemy/potions/lonely: no recipe',
      'alchemy: no single-dose batch',
      'alchemy/alchemists/alchemist-westhold: no recipe dagger-x',
      'alchemy/alchemists/twin: westhold already has an alchemist',
      'alchemy/alchemists/nowhere: unknown town nowhere',
      'alchemy/alchemists/village: villages have no alchemist',
    ]);
  });
});
