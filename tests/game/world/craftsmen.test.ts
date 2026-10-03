import { describe, expect, it } from 'vitest';
import { craftingReferenceErrors } from '../../../src/data/crafting-check.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { entryPrice, findItem, type CatalogItem } from '../../../src/game/character/items.ts';
import { collect, commission } from '../../../src/game/world/commissions.ts';
import {
  buyComponent,
  buyMagic,
  componentPrice,
  craftsmanHere,
  craftsmanState,
  partyMember,
  sellComponent,
  sellLootTo,
  tierOf,
  visitCraftsman,
} from '../../../src/game/world/craftsmen.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { entryText } from '../../../src/render/town-view.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from './helpers.ts';

/** The starters in Westhold, called on Hagen: one +1 spear in stock, two cold irons for sale. */
function atHagen(faces: number[] = []): World {
  const w = world([1, 0, 1, 2, 2, ...faces]);
  w.purse = 1000;
  expect(visitCraftsman(w, data)).toEqual({ ok: true });
  return w;
}
const hagen = data.content.craftsmen[0] as (typeof data.content.craftsmen)[0];

describe('craftsmen (docs/rules-adaptation.md, Crafting and modifying gear: Craftsmen)', () => {
  it('work in towns, and draw their month’s stock when called on', () => {
    const w = world([]);
    expect(craftsmanHere(w, data)?.name).toBe('Hagen the Smith');
    expect(craftsmanState(w, data, hagen)).toBeNull();
    const at = atHagen();
    expect(craftsmanState(at, data, hagen)).toEqual({
      since: 0,
      pool: 300,
      stock: [{ weapon: 'spear-light', bonus: 1 }],
      parts: { 'cold-iron': 2 },
    });
    // Called on again the same month, nothing is drawn.
    expect(visitCraftsman(at, data)).toEqual({ ok: true });
    at.day += 30;
    expect(craftsmanState(at, data, hagen)).toBeNull();
    at.position = { col: 17, row: 4 };
    expect(craftsmanHere(at, data)).toBeUndefined();
    expect(visitCraftsman(at, data)).toEqual({
      ok: false,
      reason: 'No craftsman works in Highcairn.',
    });
  });

  it('rolls +2 and +3 weapons more rarely', () => {
    const w = world([2, 1, 8, 4, 10, 0, 0]);
    visitCraftsman(w, data);
    expect(w.craftsmen['smith-westhold']?.stock).toEqual([
      { weapon: 'sword-short', bonus: 2 },
      { weapon: 'sword-long', bonus: 3 },
    ]);
  });

  it('must be called on first, outside a fight', () => {
    const w = world([]);
    expect(sellLootTo(w, data)).toEqual({ ok: false, reason: 'Call on Hagen the Smith first.' });
    for (const act of [
      () => sellComponent(w, data, 'cold-iron'),
      () => buyComponent(w, data, 'cold-iron'),
      () => buyMagic(w, data, 0, 'm-0'),
    ])
      expect(act()).toEqual({ ok: false, reason: 'Call on Hagen the Smith first.' });
    const at = atHagen();
    at.encounter = encounter([['thug-or-militia']]);
    expect(sellLootTo(at, data)).toMatchObject({ ok: false });
    at.encounter = null;
    at.position = { col: 17, row: 4 };
    expect(sellLootTo(at, data)).toEqual({
      ok: false,
      reason: 'No craftsman works in Highcairn.',
    });
  });

  it('buy loot dice one at a time while the trade pool lasts', () => {
    const w = atHagen([6, 5, 4]);
    expect(sellLootTo(w, data)).toEqual({ ok: false, reason: 'The party carries no loot.' });
    w.loot = [{ count: 3, sides: 6 }];
    (w.craftsmen['smith-westhold'] as { pool: number }).pool = 12;
    const purse = w.purse;
    expect(sellLootTo(w, data)).toEqual({ ok: true });
    expect(w.purse).toBe(purse + 11);
    expect(w.loot).toEqual([{ count: 1, sides: 6 }]);
    expect(w.log.at(-1)).toContain('Hagen the Smith buys 2 loot dice for 11 crowns.');
    w.rng = scriptedRng([3]);
    expect(sellLootTo(w, data)).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain("Hagen the Smith can't pay for any more loot this month.");
    w.rng = scriptedRng([1]);
    sellLootTo(w, data);
    expect(w.log.at(-1)).toContain('buys 1 loot die for 1 crowns.');
  });

  it('buy and sell components by rarity, at double to sell', () => {
    const w = atHagen();
    expect(componentPrice(data, 'cold-iron')).toBe(25);
    expect(() => componentPrice(data, 'mithril')).toThrow('unknown component mithril');
    expect(sellComponent(w, data, 'cold-iron')).toEqual({
      ok: false,
      reason: 'The party has no cold iron.',
    });
    expect(buyComponent(w, data, 'grave-garnet')).toEqual({
      ok: false,
      reason: 'Hagen the Smith has no grave garnet to sell.',
    });
    w.purse = 10;
    expect(buyComponent(w, data, 'cold-iron')).toEqual({
      ok: false,
      reason: 'That costs 50 crowns.',
    });
    w.purse = 1000;
    expect(buyComponent(w, data, 'cold-iron')).toEqual({ ok: true });
    expect(buyComponent(w, data, 'cold-iron')).toEqual({ ok: true });
    expect(w.components).toEqual({ 'cold-iron': 2 });
    expect(w.purse).toBe(900);
    const st = w.craftsmen['smith-westhold'] as { pool: number; parts: object };
    expect(st.parts).toEqual({});
    // The pool never fills past its size; a quarter counts toward the town's threshold.
    expect(st.pool).toBe(300);
    expect(w.towns.westhold?.spent).toBe(25);
    expect(sellComponent(w, data, 'cold-iron')).toEqual({ ok: true });
    expect(st.pool).toBe(275);
    expect(w.log.at(-1)).toContain('Hagen the Smith buys cold iron for 25 crowns.');
    st.pool = 10;
    expect(sellComponent(w, data, 'cold-iron')).toEqual({
      ok: false,
      reason: "Hagen the Smith can't pay 25 crowns this month.",
    });
  });

  it('sell ready-made magic weapons at the SRD price', () => {
    const w = atHagen();
    expect(() => buyMagic(w, data, 5, 'm-0')).toThrow('no stock line 5');
    expect(buyMagic(w, data, 0, 'm-0')).toEqual({ ok: false, reason: 'That costs 12500 crowns.' });
    w.purse = 13000;
    expect(buyMagic(w, data, 0, 'm-0')).toEqual({ ok: true });
    expect(member(w, 'Snag').character.inventory.at(-1)).toEqual({
      id: 'spear-light',
      quantity: 1,
      location: 'stowed',
      bonus: 1,
    });
    expect(w.craftsmen['smith-westhold']?.stock).toEqual([]);
    expect(w.log.at(-1)).toContain('Snag buys a +1 weapon from Hagen the Smith.');
    expect(() => partyMember(w, 'm-9')).toThrow('no living party member m-9');
    expect(() => tierOf(data, 4)).toThrow('no +4 tier');
  });

  it('take commissions for crowns and components, ready a month later', () => {
    const w = atHagen();
    expect(() => commission(w, data, 'halberd', 1)).toThrow("doesn't forge halberd");
    expect(commission(w, data, 'sword-long', 1)).toEqual({
      ok: false,
      reason: 'A +1 weapon needs 1 metal, 1 essence.',
    });
    w.components = { 'cold-iron': 1, 'ooze-essence': 1 };
    w.purse = 100;
    expect(commission(w, data, 'sword-long', 1)).toEqual({
      ok: false,
      reason: 'Hagen the Smith asks 250 crowns.',
    });
    w.purse = 1000;
    expect(commission(w, data, 'sword-long', 1)).toEqual({ ok: true });
    expect(w.components).toEqual({});
    expect(w.purse).toBe(750);
    expect(w.commissions).toEqual([
      { craftsman: 'smith-westhold', weapon: 'sword-long', bonus: 1, readyDay: 30 },
    ]);
    expect(w.log.at(-1)).toContain('Hagen the Smith takes on a +1 Sword, Long: ready in 30 days.');
    expect(collect(w, data, 0, 'm-1')).toEqual({ ok: false, reason: 'Not ready for 30 days.' });
    expect(() => collect(w, data, 3, 'm-1')).toThrow('no commission 3 here');
    w.day = 30;
    w.rng = scriptedRng([0, 0, 0, 0]);
    visitCraftsman(w, data);
    expect(collect(w, data, 0, 'm-1')).toEqual({ ok: true });
    expect(member(w, 'Grukk').character.inventory.at(-1)).toMatchObject({
      id: 'sword-long',
      bonus: 1,
    });
    expect(w.commissions).toEqual([]);
    expect(w.log.at(-1)).toContain('Grukk collects the +1 Sword, Long from Hagen the Smith.');
    w.encounter = encounter([['thug-or-militia']]);
    expect(commission(w, data, 'sword-long', 1)).toMatchObject({ ok: false });
    expect(collect(w, data, 0, 'm-1')).toMatchObject({ ok: false });
  });

  it('give magic weapons their bonus to hit, damage, and Shock, and their worth', () => {
    const w = world();
    const g = member(w, 'Grukk');
    const axe = (a: ReturnType<typeof characterSheet>) =>
      a.equipment.attacks.find((x) => x.id === 'axe-war');
    const before = axe(characterSheet(g.character, data));
    g.character = {
      ...g.character,
      inventory: g.character.inventory.map((e) => (e.id === 'axe-war' ? { ...e, bonus: 2 } : e)),
    };
    const after = axe(characterSheet(g.character, data));
    expect(after?.hit).toBe((before?.hit as number) + 2);
    expect(after?.damageBonus).toBe((before?.damageBonus as number) + 2);
    expect(after?.shock?.damage).toBe((before?.shock?.damage as number) + 2);
    const line = { id: 'axe-war', quantity: 1, location: 'readied' as const, bonus: 2 };
    expect(entryText(data, line)).toBe('Axe, War +2 (readied)');
    expect(entryPrice(data, findItem(data, 'axe-war') as CatalogItem, line)).toBe(10500);
  });

  it('are checked against towns and weapons', () => {
    const { srd, content } = data;
    expect(craftingReferenceErrors(srd, content)).toEqual([]);
    const broken = {
      ...content,
      craftsmen: [
        hagen,
        { ...hagen, id: 'twin' },
        { ...hagen, id: 'hill', town: 'highcairn', weapons: ['laser'] },
        { ...hagen, id: 'lost', town: 'atlantis' },
      ],
    };
    expect(craftingReferenceErrors(srd, broken)).toEqual([
      'craftsmen/twin: westhold already has a craftsman',
      'craftsmen/hill: villages have no craftsman',
      'craftsmen/hill: unknown weapon laser',
      'craftsmen/lost: unknown town atlantis',
    ]);
  });

  it('save their months and the commissions, and older saves start with none', () => {
    const w = world();
    visitCraftsman(w, data);
    w.commissions = [{ craftsman: 'smith-westhold', weapon: 'dagger', bonus: 1, readyDay: 30 }];
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.craftsmen).toEqual(w.craftsmen);
    expect(back.ok && back.world.commissions).toEqual(w.commissions);
    const save = JSON.parse(serializeWorld(w));
    delete save.craftsmen;
    delete save.commissions;
    save.schemaVersion = 12;
    const old = parseWorld(JSON.stringify(save), data);
    expect(old.ok && [old.world.craftsmen, old.world.commissions]).toEqual([{}, []]);
  });
});
