// The kinds of crafter a settlement's content gives it (docs/rules-adaptation.md, Crafters; Sam's
// calls): a smith, an alchemist, a wizard. Each tier of settlement makes room for one more kind
// (town-rules.json's crafterPlaces), and the party's own institutions fill places too
// (src/game/world/crafter-places.ts).
import type { ContentData } from './schemas/index.ts';

export const CRAFTER_KINDS = ['smith', 'alchemist', 'wizard'] as const;
export type CrafterKind = (typeof CRAFTER_KINDS)[number];

/** The kinds of crafter the content places in a settlement. */
export function contentCrafters(content: ContentData, town: string): CrafterKind[] {
  const has: Record<CrafterKind, boolean> = {
    smith: content.craftsmen.some((c) => c.town === town),
    alchemist: content.alchemy.alchemists.some((a) => a.town === town),
    wizard: content.wizards.wizards.some((x) => x.town === town),
  };
  return CRAFTER_KINDS.filter((k) => has[k]);
}
