import { contentCrafters } from './crafters.ts';
import { gameSpells } from './spells.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Wizards work in real settlements, one each, at a level the casting progression reaches; every
 * tradition has a rod of its own to make; and no settlement holds more kinds of crafter than its
 * size makes room for (docs/rules-adaptation.md, Crafters).
 */
export function crafterReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const w = content.wizards;
  const sites = content.regions.flatMap((r) => r.sites);
  const progression = srd['casting-progressions'].find((p) => p.id === w.progression);
  if (!progression) errors.push(`wizards: unknown progression ${w.progression}`);
  const towns = new Set<string>();
  for (const x of w.wizards) {
    const where = `wizards/${x.id}`;
    if (!sites.some((s) => s.id === x.town)) errors.push(`${where}: unknown town ${x.town}`);
    if (towns.has(x.town)) errors.push(`${where}: ${x.town} already has a wizard`);
    towns.add(x.town);
    if (progression && !progression.levels.some((l) => l.level === x.level))
      errors.push(`${where}: level ${x.level} is off the progression`);
  }
  const traditions = new Set(gameSpells(srd, content).map((s) => s.tradition));
  for (const t of traditions)
    if (!content.devices.devices.some((d) => d.device.kind === 'rod' && d.device.tradition === t))
      errors.push(`devices: no rod for ${t}`);
  const places = content.townRules.crafterPlaces;
  for (const s of sites) {
    if (s.kind !== 'town' || !s.size) continue;
    const kinds = contentCrafters(content, s.id);
    if (kinds.length > places[s.size])
      errors.push(`${s.id}: ${kinds.length} kinds of crafter, room for ${places[s.size]}`);
  }
  return errors;
}
