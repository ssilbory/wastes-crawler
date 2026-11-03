import { describe, expect, it } from 'vitest';
import { routesFrom } from '../../../src/game/world/coach.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { shopStock } from '../../../src/game/world/shop-stock.ts';
import {
  besieged,
  partyIn,
  settlementOf,
  siegeHere,
  siegesOf,
} from '../../../src/game/world/siege-state.ts';
import { priceHere, raidedCost } from '../../../src/game/world/town-prices.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, encounter, siege, world } from './helpers.ts';

const CINDERHOLD = { col: 6, row: 12 };

/** The party in Cinderhold. */
function inCinderhold(): World {
  const w = world();
  enterRegion(w, 'dark-lands', CINDERHOLD);
  w.position = { ...CINDERHOLD };
  return w;
}

describe('a besieged settlement (docs/rules-adaptation.md, Sieges: Blockade)', () => {
  it('knows its sieges, and whether the party stands in one', () => {
    const w = inCinderhold();
    expect([besieged(w, 'cinderhold'), siegeHere(w, data)]).toEqual([false, undefined]);
    const s = siege();
    w.sieges = [s, siege({ town: 'gutterwick' })];
    expect(besieged(w, 'cinderhold')).toBe(true);
    expect(siegesOf(w, 'cinderhold')).toEqual([s]);
    expect(siegeHere(w, data)).toBe(s);
    expect(settlementOf(data, 'cinderhold')).toMatchObject({ region: 'dark-lands' });
    expect(settlementOf(data, 'dawnwall')).toBeUndefined();
    expect(partyIn(w, data, 'dawnwall')).toBe(false);
    // Underground, on another map, beside the town, or with no party, it isn't there.
    w.dungeon = {} as World['dungeon'];
    expect(partyIn(w, data, 'cinderhold')).toBe(false);
    w.dungeon = null;
    w.position = { col: 7, row: 12 };
    expect(partyIn(w, data, 'cinderhold')).toBe(false);
    w.position = { col: 6, row: 13 };
    expect(partyIn(w, data, 'cinderhold')).toBe(false);
    w.position = { ...CINDERHOLD };
    w.region = 'borderlands';
    expect(partyIn(w, data, 'cinderhold')).toBe(false);
    w.region = 'dark-lands';
    w.members = [];
    expect(partyIn(w, data, 'cinderhold')).toBe(false);
  });

  it('sends no coach out or in', () => {
    const w = inCinderhold();
    const open = routesFrom(w, data, 'cinderhold');
    expect(open.length).toBeGreaterThan(0);
    w.sieges = [siege()];
    expect(routesFrom(w, data, 'cinderhold')).toEqual([]);
    const other = open[0]?.to.id as string;
    expect(routesFrom(w, data, other).some((r) => r.to.id === 'cinderhold')).toBe(false);
  });

  it('raises prices half again, as a sacking does, without stacking the two', () => {
    const w = inCinderhold();
    expect(raidedCost(w, data, 'cinderhold', 10)).toBe(10);
    w.sieges = [siege()];
    expect(raidedCost(w, data, 'cinderhold', 10)).toBe(15);
    w.raided.cinderhold = w.day + 5;
    expect(raidedCost(w, data, 'cinderhold', 10)).toBe(15);
    expect(priceHere(w, data, 10)).toBeGreaterThanOrEqual(15);
  });

  it('sells only what its shop had when the siege began', () => {
    const w = inCinderhold();
    w.day = 3;
    w.sieges = [siege({ stock: 3 })];
    const shelves = shopStock(w, data).map((i) => i.id);
    // A month on, the economy resets, but the shop does not restock.
    w.day = 3 + data.content.overlandRules.daysPerMonth * 2;
    expect(shopStock(w, data).map((i) => i.id)).toEqual(shelves);
    w.sieges = [];
    expect(shopStock(w, data).map((i) => i.id)).not.toEqual(shelves);
  });
});

describe('saves with sieges (version 55)', () => {
  it('drops a pending raid and starts with no sieges', () => {
    const up = WORLD_MIGRATIONS[54] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 54, raid: { town: 'cinderhold' }, raided: {} })).toEqual({
      schemaVersion: 55,
      sieges: [],
      raided: {},
    });
  });

  it('keeps sieges and the encounter’s siege fight through a save', () => {
    const w = inCinderhold();
    w.sieges = [
      siege({ camps: [{ uid: 'a1', col: 7, row: 12 }], gate: { uid: 'a1', size: 2, lost: true } }),
    ];
    const fight = { town: 'cinderhold', attacker: 'warhost', uid: 'a1', kind: 'assault' as const };
    w.encounter = { ...encounter([['beastman-trooper']]), siege: fight };
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.sieges).toEqual(w.sieges);
    expect(back.world.encounter?.siege).toEqual(fight);
  });
});
