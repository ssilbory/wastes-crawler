import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/** Each grove stands inside a known region, off its towns and ruins, and holds known monsters. */
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
    if (region.terrain[g.row]?.[g.col] === undefined) errors.push(`${where}: off the map`);
    if (region.sites.some(at)) errors.push(`${where}: stands on a town`);
    if (content.ruins.some((r) => r.region === g.region && at(r)))
      errors.push(`${where}: stands on a ruin`);
    for (const id of g.enemies.flat())
      if (!monsters.has(id)) errors.push(`${where}: unknown monster ${id}`);
  }
  return errors;
}
