import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Each grove stands on passable ground inside a known region, off its towns, roads out, garrison
 * posts, and ruins, and holds known monsters.
 */
export function groveReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  const errors: string[] = [];
  for (const g of content.groves) {
    const where = `groves/${g.id}`;
    const region = content.regions.find((r) => r.id === g.region);
    if (!region) {
      errors.push(`${where}: unknown region ${g.region}`);
      continue;
    }
    const at = (x: { col: number; row: number }) => x.col === g.col && x.row === g.row;
    const glyph = region.terrain[g.row]?.[g.col];
    if (glyph === undefined) errors.push(`${where}: off the map`);
    else if (content.terrains.find((t) => t.glyph === glyph)?.movement === 'impassable')
      errors.push(`${where}: stands on impassable ground`);
    if (region.sites.some(at)) errors.push(`${where}: stands on a town`);
    if (region.exits.some(at)) errors.push(`${where}: stands on a road out`);
    if (region.garrisons.some(at)) errors.push(`${where}: stands on a garrison post`);
    if (content.ruins.some((r) => r.region === g.region && at(r)))
      errors.push(`${where}: stands on a ruin`);
    for (const id of g.enemies.flat())
      if (!monsters.has(id)) errors.push(`${where}: unknown monster ${id}`);
  }
  return errors;
}
