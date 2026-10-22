// Special abilities and flaws on magic weapons and armor (docs/rules-adaptation.md, Potions,
// scrolls, and magic devices: Abilities and Forged magic; vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.3; 4.10.0 Creating Magic
// Items.md). An ability rides on a +1 to +3 item, one per item; flaws are what a forging that
// failed and went on anyway left in it. Character loading keeps both to real records that fit.
import type { Ability, Flaw } from '../../data/schemas/index.ts';
import type { GameData } from './context.ts';
import type { CatalogItem, InventoryEntry } from './items.ts';

export const abilityOf = (data: GameData, e: InventoryEntry): Ability | null =>
  e.ability ? (data.content.forging.abilities.find((a) => a.id === e.ability) as Ability) : null;

export const flawsOf = (data: GameData, e: InventoryEntry): Flaw[] =>
  (e.flaws ?? []).map((id) => data.content.forging.flaws.find((f) => f.id === id) as Flaw);

/** What is wrong with a line's ability or flaws for its item, or null. */
export function abilityLineProblem(
  data: GameData,
  item: CatalogItem,
  e: InventoryEntry,
): string | null {
  const kind = item.kind === 'weapon' || item.kind === 'armor' ? item.kind : null;
  const fits = (x: { targets: readonly string[] } | undefined) =>
    x !== undefined && kind !== null && x.targets.includes(kind);
  if (e.ability) {
    const a = data.content.forging.abilities.find((x) => x.id === e.ability);
    if (!fits(a) || !e.bonus) return `${item.id} can't carry the ability ${e.ability}`;
  }
  for (const id of e.flaws ?? [])
    if (!fits(data.content.forging.flaws.find((x) => x.id === id)))
      return `${item.id} can't have the flaw ${id}`;
  return null;
}
