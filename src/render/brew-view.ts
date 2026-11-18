// What a brewable item does, for the brewing panel (docs/rules-adaptation.md, Potions: Brewing).
import type { GameData } from '../game/character/context.ts';

/**
 * The description of a recipe's item: a potion's own text, or the recipe's for other gear (the
 * antidote). Empty for an item that is no recipe, or one with nothing written for it.
 */
export function brewText(data: GameData, item: string): string {
  const alchemy = data.content.alchemy;
  const recipe = alchemy.recipes.find((r) => r.item === item);
  if (!recipe) return '';
  return alchemy.potions.find((p) => p.id === item)?.text ?? recipe.text ?? '';
}
