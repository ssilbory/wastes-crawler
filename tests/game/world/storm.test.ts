import { describe, expect, it } from 'vitest';
import { pickGoal } from '../../../src/game/factions/goals.ts';
import { beginSiege } from '../../../src/game/factions/siege.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { routesFrom } from '../../../src/game/world/coach.ts';
import { holderOf } from '../../../src/game/world/siege-state.ts';
import { storm, stormTarget, stormWon } from '../../../src/game/world/storm.ts';
import { raidedCost } from '../../../src/game/world/town-prices.ts';
import type { World } from '../../../src/game/world/types.ts';
import { heldText, siegeLines, stormView } from '../../../src/render/siege-view.ts';
import { data, encounter } from './helpers.ts';
import { HILLS, heldTown, LANTERNFALL } from './siege-helpers.ts';

const holder = (w: World) => w.factions.warhost?.assets ?? [];
const won = (uid: string) =>
  ({
    kind: 'fight-won',
    quest: null,
    garrison: null,
    siege: { town: 'lanternfall', attacker: 'warhost', uid, kind: 'storm' },
  }) as const;

describe('a held settlement (docs/rules-adaptation.md, Sieges: A held settlement; Phase 23b)', () => {
  it('keeps only its shop and inn, at double prices, and no coaches', () => {
    const w = heldTown();
    expect(raidedCost(w, data, 'lanternfall', 10)).toBe(20);
    expect(raidedCost(w, data, 'mirewatch', 10)).toBe(10);
    expect(heldText(w, data, 'lanternfall')).toBe(
      "Held by Grisk's Warhost: shop and inn only, at 2 times the price",
    );
    expect(heldText(w, data, 'mirewatch')).toBeNull();
    expect(siegeLines(w, data)).toEqual(["Lanternfall is held by Grisk's Warhost."]);
    // The Ash Road runs from Gutterwick; no route runs to or from a held town.
    expect(routesFrom(w, data, 'lanternfall')).toEqual([]);
    expect(routesFrom(w, data, 'gutterwick').some((r) => r.to.id === 'lanternfall')).toBe(false);
  });
});

describe('storming a held settlement (Sam’s call: the party may retake it alone)', () => {
  it('faces the holder’s sturdiest asset there, then the base’s guard', () => {
    const w = heldTown();
    // The scouts, weaker, stand in town too: the party meets the warband.
    const scouts = holder(w).find((a) => a.asset === 'scouts');
    if (scouts) scouts.at = 'lanternfall';
    expect(stormTarget(w, data)).toMatchObject({
      town: 'lanternfall',
      holder: 'warhost',
      uid: 'a1',
      name: "Grisk's Warhost's Beastman Warband",
      rows: [['beastman-trooper', 'beastman-trooper', 'beastman-trooper'], ['predator-beastman']],
    });
    expect(stormView(w, data)).toEqual({ name: "Grisk's Warhost's Beastman Warband", fighters: 4 });
    // Worn to 2, the warband gives way to the sturdier scouts.
    const band = holder(w).find((a) => a.asset === 'infantry');
    if (band) band.hp = 2;
    expect(stormTarget(w, data)?.uid).toBe(scouts?.uid);
    const s = w.factions.warhost;
    if (s) s.assets = s.assets.filter((a) => a.at !== 'lanternfall');
    expect(stormTarget(w, data)).toMatchObject({
      uid: 'base',
      name: "Grisk's Warhost's hold on Lanternfall",
      rows: [['thug-or-militia', 'thug-or-militia']],
    });
  });

  it('is nothing to storm outside a held town, or underground', () => {
    expect(stormTarget(heldTown(HILLS), data)).toBeNull();
    const w = heldTown();
    w.dungeon = {} as World['dungeon'];
    expect(stormTarget(w, data)).toBeNull();
    expect(stormView(heldTown(HILLS), data)).toBeNull();
    const free = heldTown({ col: 6, row: 12 });
    expect(stormTarget(free, data)).toBeNull();
  });

  it('starts the fight, joining the ally’s siege of the town', () => {
    const w = heldTown();
    expect(storm(heldTown(HILLS), data)).toEqual({
      ok: false,
      reason: 'No rival holds this town.',
    });
    const siege = beginSiege(w, data, 'settlements', 'lanternfall', 'warhost');
    expect(storm(w, data)).toEqual({ ok: true });
    expect(w.encounter?.siege).toEqual({
      town: 'lanternfall',
      attacker: 'warhost',
      uid: 'a1',
      kind: 'storm',
    });
    expect(w.log.at(-1)).toContain("The party storms Grisk's Warhost's Beastman Warband!");
    expect(siege).toMatchObject({ joined: true, next: w.day });
    expect(storm(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
  });

  it('breaks the asset, then razes the base, and the town is free: Renown', () => {
    const w = heldTown();
    w.encounter = encounter([['beastman-trooper']]);
    emit(w, data, won('a1'));
    expect(holder(w).some((a) => a.uid === 'a1')).toBe(false);
    expect(holderOf(w, data, 'lanternfall')).toBe('warhost');
    emit(w, data, won('base'));
    expect(holderOf(w, data, 'lanternfall')).toBeNull();
    expect(w.factions.settlements?.bases.some((b) => b.at === 'lanternfall')).toBe(true);
    expect(w.renown).toBe(2);
  });

  it('pays once when the ally’s siege there ends with it', () => {
    const w = heldTown();
    const s = w.factions.warhost;
    if (s) s.assets = s.assets.filter((a) => a.at !== 'lanternfall');
    for (const a of w.factions.settlements?.assets ?? []) a.at = 'lanternfall';
    const siege = beginSiege(w, data, 'settlements', 'lanternfall', 'warhost');
    siege.joined = true;
    stormWon(w, data, { town: 'lanternfall', attacker: 'warhost', uid: 'base', kind: 'storm' });
    expect(w.sieges).toEqual([]);
    expect(w.renown).toBe(2);
    // A win over something already gone changes nothing.
    stormWon(w, data, { town: 'lanternfall', attacker: 'warhost', uid: 'a9', kind: 'storm' });
    stormWon(w, data, { town: 'lanternfall', attacker: 'nobody', uid: 'base', kind: 'storm' });
    expect(w.renown).toBe(2);
  });
});

describe('the ally’s own siege of a held settlement, with the party inside', () => {
  it('gives the party no share, no gate fight, and no camps to fall on', () => {
    const w = heldTown();
    for (const a of w.factions.settlements?.assets ?? []) a.at = 'lanternfall';
    pickGoal(w, data, 'settlements', 0);
    const s = beginSiege(w, data, 'settlements', 'lanternfall', 'warhost');
    s.next = w.day;
    emit(w, data, { kind: 'day-passed' });
    expect(w.encounter?.siege?.kind).not.toBe('assault');
    expect(w.position).toEqual(LANTERNFALL);
    w.encounter = null;
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    expect(w.encounter).toBeNull();
    const camp = s.camps[0];
    if (camp) w.position = { col: camp.col, row: camp.row };
    emit(w, data, { kind: 'hex-entered' });
    const after: World['encounter'] = w.encounter as World['encounter'];
    expect(after?.siege).toBeUndefined();
  });
});
