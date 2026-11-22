// The mods a smith builds and what plain work costs ready-made (docs/rules-adaptation.md, Crafting
// and modifying gear: Craftsmen; Sam's calls). A smith builds mods as a PC with Craft does
// (vendor/wwn-srd/2.0 The Rules of the Game/2.8.0 Crafting and Modifying Gear.md, 2.8.2): only those
// of their own Craft level or lower, and only onto gear they fit (2.8.4). Reads only, and imports
// nothing of the town's other trades, so craftsmen.ts can draw stock with it.
import type { Commission, Craftsman, Mod } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { findItem, tenths, type CatalogItem } from '../character/items.ts';
import { toTenths } from '../../rules/economy.ts';

/** A weapon or suit of armor as a smith makes it: the commission's fields, less who and when. */
export type Piece = Omit<Commission, 'craftsman' | 'readyDay'>;

export const itemOf = (data: GameData, id: string) => findItem(data, id) as CatalogItem;

/** An item's own market price in crowns. */
export const ownPrice = (data: GameData, id: string) => {
  const cost = itemOf(data, id).cost;
  return cost ? tenths(cost) / 10 : 0;
};

/** The item's price at its quality: mastercrafted is ten times the cost (SRD 2.8.1). */
export const qualityPrice = (data: GameData, piece: Piece) =>
  ownPrice(data, piece.weapon) *
  (piece.quality ? data.content.craftingRules.quality.mastercrafted.cost : 1);

export function modById(data: GameData, id: string): Mod {
  const mod = data.content.mods.find((m) => m.id === id);
  if (!mod) throw new Error(`unknown mod ${id}`);
  return mod;
}

/** Whether a mod fits a weapon or suit at all (SRD 2.8.4's targets). */
export function modFits(data: GameData, item: string, mod: Mod): boolean {
  const it = itemOf(data, item);
  if (it.kind !== 'weapon' && it.kind !== 'armor') return false;
  if (!mod.targets.includes(it.kind)) return false;
  return !mod.rangedOnly || (it.kind === 'weapon' && Boolean(it.weapon.range));
}

/** The mods a smith builds onto an item: those that fit it, up to their Craft level. */
export const modsFor = (data: GameData, c: Craftsman, item: string): Mod[] =>
  data.content.mods.filter((m) => m.minCraft <= c.craft && modFits(data, item, m));

/** A mod's loot dice, as crowns at their highest face (docs/rules-adaptation.md, Mod time). */
export const modCrowns = (mod: Mod) => mod.loot.count * mod.loot.sides;

/**
 * A ready-made plain piece's price (Sam's call): the item at its quality, at market price, and its
 * mod at `readyModMultiplier` times its order crowns, as magic stock costs about four times a
 * commission. The smith has already put in the mod's components.
 */
export function goodsPrice(data: GameData, piece: Piece): number {
  const mod = piece.mod ? modCrowns(modById(data, piece.mod)) : 0;
  const markup = data.content.craftingRules.craftsmen.readyModMultiplier;
  return toTenths(qualityPrice(data, piece) + mod * markup);
}
