import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Salvage (docs/rules-adaptation.md, Salvage): each type's part is a scrap component of that type,
 * every yield has a part to become, and only real weapons, armor, shields, and gear yield.
 */
export function salvageReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const { parts, yields } = content.craftingRules.salvage;
  for (const [type, id] of Object.entries(parts)) {
    const part = content.components.find((c) => c.id === id);
    if (part?.type !== type || part.rarity !== 'scrap')
      errors.push(`craftingRules: salvaged ${type} must be a scrap ${type} component, not ${id}`);
  }
  const items = new Set(
    [...srd.weapons, ...srd.armor, ...content.shields, ...srd.gear].map((i) => i.id),
  );
  for (const [id, y] of Object.entries(yields)) {
    if (!items.has(id)) errors.push(`craftingRules: salvage from unknown item ${id}`);
    if (!parts[y.type])
      errors.push(`craftingRules: ${id} salvages to ${y.type}, which has no part`);
  }
  return errors;
}
