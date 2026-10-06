// What the party carries in common, for the map and dungeon screens: the purse, loot dice, and
// crafting components (docs/rules-adaptation.md, Loot dice and Plants' components).
import type { GameData } from '../game/character/context.ts';
import { componentName } from '../game/world/components.ts';
import type { World } from '../game/world/types.ts';
import { crowns, lootText } from './town-view.ts';

export interface StashView {
  purse: string;
  loot: string;
  /** "Ironwood heart ×2", by name. */
  components: string[];
}

export function stashView(w: World, data: GameData): StashView {
  return {
    purse: crowns(w.purse),
    loot: lootText(w.loot),
    components: Object.entries(w.components)
      .map(([id, n]) => `${componentName(data, id)}${n > 1 ? ` ×${n}` : ''}`)
      .sort(),
  };
}
