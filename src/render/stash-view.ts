// What the party carries in common, for the map and dungeon screens: the purse, loot dice, and
// crafting components (docs/rules-adaptation.md, Loot dice and Plants' components).
import type { GameData } from '../game/character/context.ts';
import { componentName } from '../game/world/components.ts';
import { partyLoad, type PartyLoad } from '../game/world/party-load.ts';
import type { World } from '../game/world/types.ts';
import { crowns, lootText } from './town-view.ts';

export interface StashView {
  purse: string;
  loot: string;
  /** "Ironwood heart ×2", by name. */
  components: string[];
  /** Salvaged fractions short of a whole part: "0.75 metal, 0.5 wood", or none. */
  scrap: string | null;
  /** What the loot and components weigh, and how much is past what the party can carry. */
  weight: string;
  /** Each die size and component that can be left behind. */
  dice: { sides: number; label: string }[];
  parts: { id: string; label: string }[];
}

export function stashView(w: World, data: GameData): StashView {
  return {
    purse: crowns(w.purse),
    loot: lootText(w.loot),
    components: Object.entries(w.components)
      .map(([id, n]) => `${componentName(data, id)}${n > 1 ? ` ×${n}` : ''}`)
      .sort(),
    scrap:
      Object.entries(w.scrap)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([type, n]) => `${n} ${type}`)
        .join(', ') || null,
    weight: weightText(partyLoad(w, data)),
    dice: w.loot.map((d) => ({ sides: d.sides, label: `d${d.sides}` })),
    parts: Object.keys(w.components)
      .map((id) => ({ id, label: componentName(data, id) }))
      .sort((a, b) => a.label.localeCompare(b.label)),
  };
}

/** "Weighs 4 Stowed items", and how far past the party's limits it is. */
export function weightText(p: PartyLoad): string {
  const base = `Weighs ${p.weight} Stowed item${p.weight === 1 ? '' : 's'}`;
  return p.overflow > 0 ? `${base}; the party is too heavy by ${p.overflow}` : base;
}
