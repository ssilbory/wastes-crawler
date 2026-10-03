import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/** Coach routes join two different real towns; arena cards are for real towns with real monsters. */
export function travelReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const towns = new Set(content.regions.flatMap((r) => r.sites.map((s) => s.id)));
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  for (const r of content.coachRoutes) {
    for (const t of r.towns)
      if (!towns.has(t)) errors.push(`coachRoutes/${r.id}: unknown town ${t}`);
    if (r.towns[0] === r.towns[1]) errors.push(`coachRoutes/${r.id}: goes nowhere`);
  }
  for (const card of content.arenaCards) {
    if (!towns.has(card.town)) errors.push(`arenaCards: unknown town ${card.town}`);
    for (const b of card.bouts)
      for (const id of b.enemies.flat())
        if (!monsters.has(id))
          errors.push(`arenaCards/${card.town}/${b.id}: unknown monster ${id}`);
  }
  const cards = content.arenaCards.map((c) => c.town);
  if (new Set(cards).size !== cards.length) errors.push('arenaCards: two cards for one town');
  return errors;
}
