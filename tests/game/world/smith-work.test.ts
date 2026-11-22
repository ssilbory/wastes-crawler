import { describe, expect, it } from 'vitest';
import { collect, commission } from '../../../src/game/world/commissions.ts';
import { buyGoods, visitCraftsman } from '../../../src/game/world/craftsmen.ts';
import { upkeepNeed } from '../../../src/game/world/maintenance.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { goodsPrice, modsFor } from '../../../src/game/world/smith-mods.ts';
import { pieceMisfit, pieceName, pieceTerms } from '../../../src/game/world/smith-work.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

const hagen = data.content.craftsmen[0] as (typeof data.content.craftsmen)[0];
const grashna = data.content.craftsmen.find((c) => c.id === 'smith-cinderhold') as typeof hagen;

/**
 * Hagen with no magic stock, two cold irons, and three plain pieces: a long sword, a mastercrafted
 * long sword, and a dagger with Razor Edge (his fourth mod for it: Customized, Omened Aim, Razor
 * Edge, Balanced Fittings, index 2).
 */
function atHagen() {
  const w = world([0, 2, 2, 3, 4, 1, 4, 4, 3, 6, 2]);
  w.purse = 5000;
  expect(visitCraftsman(w, data)).toEqual({ ok: true });
  return w;
}

describe('smiths work like PCs with Craft (docs/rules-adaptation.md, Craftsmen)', () => {
  it('build only the mods of their Craft level or lower that fit the item', () => {
    expect(hagen.craft).toBe(2);
    expect(modsFor(data, hagen, 'sword-long').map((m) => m.id)).toEqual([
      'customized',
      'razor-edge',
      'balanced-fittings',
    ]);
    // A dagger is thrown, so Omened Aim fits; armor takes armor mods.
    expect(modsFor(data, hagen, 'dagger').map((m) => m.id)).toContain('omened-aim');
    expect(modsFor(data, hagen, 'mail-shirt').map((m) => m.id)).toEqual([
      'customized',
      'tailored-harness',
    ]);
    expect(modsFor(data, grashna, 'sword-long').map((m) => m.id)).toContain('thirsting-blade');
  });

  it('say why they can’t make a piece', () => {
    expect(pieceMisfit(data, hagen, { weapon: 'halberd' })).toBe(
      "Hagen the Smith doesn't make a Halberd.",
    );
    expect(pieceMisfit(data, hagen, { weapon: 'sword-long', mod: 'thirsting-blade' })).toBe(
      'Thirsting Blade needs Craft-3; Hagen the Smith has 2.',
    );
    expect(pieceMisfit(data, hagen, { weapon: 'sword-long', mod: 'tailored-harness' })).toBe(
      "Tailored Harness doesn't fit it.",
    );
    expect(pieceMisfit(data, hagen, { weapon: 'sword-long', ability: 'flaming' })).toBe(
      'Only magic gear takes an ability.',
    );
    expect(pieceMisfit(data, hagen, { weapon: 'sword-long', mod: 'razor-edge' })).toBeNull();
    expect(pieceMisfit(data, grashna, { weapon: 'sword-long', mod: 'thirsting-blade' })).toBeNull();
  });

  it('price a piece as its parts, its mod’s dice, and its magic, and add up the days', () => {
    expect(pieceTerms(data, { weapon: 'sword-long' })).toEqual({
      crowns: 100,
      components: [],
      days: 7,
    });
    // SRD 2.8.1: mastercrafted is ten times the cost and twice the time.
    expect(pieceTerms(data, { weapon: 'sword-long', quality: 'mastercrafted' })).toEqual({
      crowns: 1000,
      components: [],
      days: 14,
    });
    // Razor Edge: 29d6 at 6 a die, a metal, and two weeks of work halved.
    expect(pieceTerms(data, { weapon: 'sword-long', mod: 'razor-edge' })).toEqual({
      crowns: 274,
      components: [{ type: 'metal', count: 1 }],
      days: 14,
    });
    // All of it: the mastercrafted build's extra week goes on the magic's month.
    const all = { weapon: 'sword-long', quality: 'mastercrafted', mod: 'razor-edge', bonus: 1 };
    expect(pieceTerms(data, all as Parameters<typeof pieceTerms>[1])).toEqual({
      crowns: 1374,
      components: [
        { type: 'metal', count: 1 },
        { type: 'essence', count: 1 },
        { type: 'metal', count: 1 },
      ],
      days: 44,
    });
    expect(pieceName(data, all as Parameters<typeof pieceName>[1])).toBe(
      'mastercrafted Sword, Long +1 with Razor Edge',
    );
    expect(pieceName(data, { weapon: 'dagger', bonus: 2, ability: 'flaming' })).toBe(
      'Dagger +2 (Flaming)',
    );
  });

  it('draw plain, mastercrafted, and modded pieces for the month', () => {
    const w = atHagen();
    expect(w.craftsmen['smith-westhold']?.goods).toEqual([
      { item: 'sword-long' },
      { item: 'sword-long', quality: 'mastercrafted' },
      { item: 'dagger', mod: 'razor-edge' },
    ]);
    // A modded draw for an item no mod of theirs fits comes out plain.
    const bare = { ...hagen, craft: 1, weapons: ['sword-long'], armor: [] };
    const solo = { ...data, content: { ...data.content, craftsmen: [bare] } };
    const v = world([0, 2, 2, 1, 0, 6, 0]);
    visitCraftsman(v, solo);
    expect(v.craftsmen['smith-westhold']?.goods).toEqual([
      { item: 'sword-long', mod: 'customized' },
    ]);
  });

  it('sell ready-made pieces at market price, mods at four times their dice', () => {
    const w = atHagen();
    expect(goodsPrice(data, { weapon: 'sword-long' })).toBe(100);
    expect(goodsPrice(data, { weapon: 'sword-long', quality: 'mastercrafted' })).toBe(1000);
    expect(goodsPrice(data, { weapon: 'dagger', mod: 'razor-edge' })).toBe(699);
    expect(() => buyGoods(w, data, 9, 'm-0')).toThrow('no goods line 9');
    w.purse = 50;
    expect(buyGoods(w, data, 2, 'm-0')).toEqual({ ok: false, reason: 'That costs 699 crowns.' });
    w.purse = 5000;
    expect(buyGoods(w, data, 2, 'm-0')).toEqual({ ok: true });
    const line = member(w, 'Snag').character.inventory.at(-1);
    expect(line).toEqual({
      id: 'dagger',
      quantity: 1,
      location: 'stowed',
      mods: [{ id: 'razor-edge', components: [] }],
    });
    // A bought mod needs keeping up like any other.
    expect(upkeepNeed(data, line as NonNullable<typeof line>)).toEqual({ level: 2, points: 1 });
    expect(w.log.at(-1)).toContain('Snag buys a dagger with Razor Edge from Hagen the Smith.');
    expect(buyGoods(w, data, 1, 'm-1')).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('Grukk buys a mastercrafted sword, long from Hagen the Smith.');
    expect(w.craftsmen['smith-westhold']?.goods).toEqual([{ item: 'sword-long' }]);
  });

  it('take commissions for mastercrafted, modded, and magic work at once', () => {
    const w = atHagen();
    const piece = {
      weapon: 'sword-long',
      quality: 'mastercrafted' as const,
      mod: 'razor-edge',
      bonus: 1,
    };
    expect(commission(w, data, { weapon: 'sword-long', mod: 'thirsting-blade' })).toEqual({
      ok: false,
      reason: 'Thirsting Blade needs Craft-3; Hagen the Smith has 2.',
    });
    expect(commission(w, data, piece)).toEqual({
      ok: false,
      reason: 'A mastercrafted Sword, Long +1 with Razor Edge needs 1 metal, 1 essence, 1 metal.',
    });
    w.components = { 'cold-iron': 2, 'ooze-essence': 1 };
    expect(commission(w, data, piece)).toEqual({ ok: true });
    expect(w.components).toEqual({});
    expect(w.purse).toBe(5000 - 1374);
    expect(w.commissions).toEqual([{ craftsman: 'smith-westhold', ...piece, readyDay: 44 }]);
    expect(w.log.at(-1)).toContain('ready in 44 days');
    w.day = 44;
    w.rng = scriptedRng([0, 0, 0, 0]);
    visitCraftsman(w, data);
    expect(collect(w, data, 0, 'm-1')).toEqual({ ok: true });
    const line = member(w, 'Grukk').character.inventory.at(-1);
    // The creator's first mod on their own mastercrafted work needs no upkeep (SRD 2.8.1).
    expect(line).toEqual({
      id: 'sword-long',
      quantity: 1,
      location: 'stowed',
      quality: 'mastercrafted',
      mods: [{ id: 'razor-edge', components: [], free: true }],
      bonus: 1,
    });
    expect(upkeepNeed(data, line as NonNullable<typeof line>)).toBeNull();
    expect(w.log.at(-1)).toContain(
      'Grukk collects the mastercrafted Sword, Long +1 with Razor Edge from Hagen the Smith.',
    );
  });

  it('take plain commissions for crowns alone', () => {
    const w = atHagen();
    expect(commission(w, data, { weapon: 'mail-shirt', quality: 'mastercrafted' })).toEqual({
      ok: true,
    });
    expect(w.purse).toBe(2500);
    expect(w.commissions[0]?.readyDay).toBe(14);
  });

  it('start old saves’ months with no plain work, and no wizards called on', () => {
    const up = WORLD_MIGRATIONS[58] as (raw: Record<string, unknown>) => Record<string, unknown>;
    const st = { since: 0, pool: 300, stock: [], parts: {} };
    expect(up({ schemaVersion: 58, craftsmen: { 'smith-westhold': st } })).toEqual({
      schemaVersion: 59,
      craftsmen: { 'smith-westhold': { ...st, goods: [] } },
      wizards: {},
      wizardOrders: [],
    });
  });
});
