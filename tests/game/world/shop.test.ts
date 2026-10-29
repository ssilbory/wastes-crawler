import { describe, expect, it } from 'vitest';
import type { Site } from '../../../src/data/schemas/index.ts';
import { buyable } from '../../../src/game/character/items.ts';
import { buy } from '../../../src/game/world/shop.ts';
import { afterSale, drawnStock, shopMonth, shopStock } from '../../../src/game/world/shop-stock.ts';
import { townHere } from '../../../src/game/world/town-prices.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, fullShop, member, world } from './helpers.ts';

const shop = data.content.townRules.shop;
const staples = shop.staples;
const ids = (items: { id: string }[]) => items.map((i) => i.id);
const rest = buyable(data).filter((i) => !staples.includes(i.id)).length;
const sized = (w: ReturnType<typeof world>, size: Site['size']): Site => ({
  ...townHere(w, data),
  size,
});
/** Every item stocked, but sold out as often as the content says. */
const allStocked = {
  ...data,
  content: {
    ...data.content,
    townRules: {
      ...data.content.townRules,
      shop: { ...shop, stocked: fullShop.content.townRules.shop.stocked },
    },
  },
};

describe('buying small armor (docs/rules-adaptation.md, Small armor)', () => {
  it('names an item it does not stock by its id', () => {
    const w = world();
    w.purse = 1000;
    expect(buy(w, data, 'm-0', 'moon-lance', 'small')).toEqual({
      ok: false,
      reason: 'Rubblegate has no moon-lance for sale.',
    });
  });
});

describe("what a shop stocks (docs/rules-adaptation.md, Shop stock; Sam's calls)", () => {
  it('always has the light and crafting staples', () => {
    const w = world();
    for (const size of ['village', 'town', 'city'] as const)
      expect(ids(drawnStock(w, data, sized(w, size)))).toEqual(expect.arrayContaining(staples));
  });

  it('stocks a quarter of the rest in a village, half in a town, three quarters in a city', () => {
    const w = world();
    const others = (size: Site['size']) =>
      drawnStock(w, data, sized(w, size)).length - staples.length;
    expect(others('village')).toBe(Math.round(rest / 4));
    expect(others('town')).toBe(Math.round(rest / 2));
    expect(others('city')).toBe(Math.round((rest * 3) / 4));
  });

  it('draws the same stock all month, and afresh the next month or in another town', () => {
    const w = world();
    const town = townHere(w, data);
    const first = ids(drawnStock(w, data, town));
    w.day += 1;
    expect(ids(drawnStock(w, data, town))).toEqual(first);
    w.day = 30 * (shopMonth(w, data) + 1);
    expect(ids(drawnStock(w, data, town))).not.toEqual(first);
    w.day = 0;
    expect(ids(drawnStock(w, data, { ...town, id: 'elsewhere' }))).not.toEqual(first);
  });

  it('moves nothing else the world rolls', () => {
    const w = world();
    const before = w.rng.state();
    shopStock(w, data);
    expect(w.rng.state()).toEqual(before);
  });

  it('sells only the staples and its own short list in the Wastes, whatever the size', () => {
    const w = world();
    w.realm = 'wastes';
    const wastes = data.content.realms.find((r) => r.id === 'wastes')?.shop ?? [];
    for (const size of ['village', 'city'] as const)
      expect(ids(drawnStock(w, data, sized(w, size))).sort()).toEqual(
        [...staples, ...wastes].sort(),
      );
  });
});

describe('selling out', () => {
  it('never runs out of a staple, and rolls nothing for one', () => {
    const w = world();
    w.rng = scriptedRng([]);
    expect(afterSale(w, data, 'torch')).toBe(false);
    expect(w.shops).toEqual({});
  });

  it("sells out at or under the town's chance, until the month turns", () => {
    const w = world();
    const percent = shop.sellOutPercent.town;
    w.rng = scriptedRng([percent + 1, percent, 1]);
    expect(afterSale(w, allStocked, 'crowbar')).toBe(false);
    expect(afterSale(w, allStocked, 'crowbar')).toBe(true);
    expect(afterSale(w, allStocked, 'mail-shirt')).toBe(true);
    expect(w.shops.westhold).toEqual({ month: 0, sold: ['crowbar', 'mail-shirt'] });
    expect(ids(shopStock(w, allStocked))).not.toContain('crowbar');
    w.day = 30;
    expect(ids(shopStock(w, allStocked))).toContain('crowbar');
    w.rng = scriptedRng([1]);
    afterSale(w, allStocked, 'dagger');
    expect(w.shops.westhold).toEqual({ month: 1, sold: ['dagger'] });
  });

  it("tells the party when it bought a shop's last one, and won't sell another", () => {
    const w = world();
    w.purse = 1000;
    w.rng = scriptedRng([1]);
    expect(buy(w, allStocked, 'm-0', 'crowbar')).toEqual({ ok: true });
    expect(w.log.at(-1)).toMatch(/That was Rubblegate's last Crowbar this month.$/);
    expect(buy(w, allStocked, 'm-0', 'crowbar')).toEqual({
      ok: false,
      reason: 'Rubblegate has no Crowbar for sale.',
    });
    expect(member(w, 'Snag').character.inventory.at(-1)?.id).toBe('crowbar');
  });
});
