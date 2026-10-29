import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * XP tiers run from a 0 down rate, the easiest first, each harder than the last; the shop's
 * staples and each realm's short list name gear a shop sells.
 */
export function townReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const tiers = content.townRules.xp.tiers;
  if (tiers[0]?.minDownRate !== 0)
    errors.push('townRules: the first XP tier must start at a 0 down rate');
  if (tiers.some((t, i) => i > 0 && t.minDownRate <= (tiers[i - 1] as typeof t).minDownRate))
    errors.push('townRules: XP tiers must run from the lowest down rate up');
  // What the shop sells (src/game/character/items.ts buyable): priced gear, never potions or magic.
  const sold = new Set(
    [
      ...srd.weapons,
      ...srd.armor.filter((a) => a.category !== 'shield'),
      ...content.shields,
      ...srd.gear,
      ...srd['gear-bundles'],
      content.ailments.antidote,
      content.craftingRules.tools,
      content.alchemy.kit,
    ]
      .filter((i) => i.cost !== null)
      .map((i) => i.id),
  );
  for (const id of content.townRules.shop.staples)
    if (!sold.has(id)) errors.push(`townRules: the shop's staple ${id} isn't shop gear`);
  for (const realm of content.realms)
    for (const id of realm.shop ?? [])
      if (!sold.has(id)) errors.push(`realms/${realm.id}: the shop's ${id} isn't shop gear`);
  return errors;
}
