// What a settlement's shop has (Sam's calls, docs/rules-adaptation.md, Shop stock and the Wastes'
// Shops): light and crafting gear is always on the shelf and never runs out. A realm with its own
// short list (the Wastes) sells only that besides; anywhere else a shop stocks a random share of
// the rest by its settlement's size, drawn from the world's seed afresh whenever the town's economy
// resets (its thresholds, town-prices.ts). Anything else bought may be the last until then,
// likelier the smaller the place.
import type { Site } from '../../data/schemas/index.ts';
import { createRng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { buyable, type CatalogItem } from '../character/items.ts';
import { currentLedger, townHere } from './town-prices.ts';
import type { World } from './types.ts';

const rules = (data: GameData) => data.content.townRules.shop;

/** The day the town's economy last reset; its shop restocks with it. */
const stockedSince = (w: World, data: GameData, town: Site) => currentLedger(w, data, town).since;

/** What a town's shop puts out until its economy resets, before anything sells out. */
export function drawnStock(w: World, data: GameData, town: Site): CatalogItem[] {
  const all = buyable(data);
  const staples = new Set(rules(data).staples);
  const only = data.content.realms.find((r) => r.id === w.realm)?.shop;
  if (only) return all.filter((i) => staples.has(i.id) || only.includes(i.id));
  const pool = all.filter((i) => !staples.has(i.id));
  const n = Math.round(pool.length * rules(data).stocked[town.size]);
  // Its own stream, so a look at the shelves never moves the world's.
  const rng = createRng(`${w.sites.seed}:shop:${town.id}:${stockedSince(w, data, town)}`);
  for (let i = 0; i < n; i++) {
    const j = rng.int(i, pool.length - 1);
    [pool[i], pool[j]] = [pool[j] as CatalogItem, pool[i] as CatalogItem];
  }
  const picked = new Set(pool.slice(0, n).map((i) => i.id));
  return all.filter((i) => staples.has(i.id) || picked.has(i.id));
}

/** What the town's shop has sold out of since its economy reset. */
function soldOut(w: World, data: GameData, town: Site): string[] {
  const s = w.shops[town.id];
  return s && s.since === stockedSince(w, data, town) ? s.sold : [];
}

/** What the shop in the party's town has today. */
export function shopStock(w: World, data: GameData): CatalogItem[] {
  const town = townHere(w, data);
  const gone = new Set(soldOut(w, data, town));
  return drawnStock(w, data, town).filter((i) => !gone.has(i.id));
}

/** After a sale, rolls whether that was the last one until a reset; staples never run out. */
export function afterSale(w: World, data: GameData, itemId: string): boolean {
  if (rules(data).staples.includes(itemId)) return false;
  const town = townHere(w, data);
  if (w.rng.int(1, 100) > rules(data).sellOutPercent[town.size]) return false;
  w.shops[town.id] = {
    since: stockedSince(w, data, town),
    sold: [...soldOut(w, data, town), itemId],
  };
  return true;
}
