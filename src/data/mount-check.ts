// Mount content (docs/rules-adaptation.md, Mounts) must name real monsters and skills.
import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';
import { gameSkills } from './skills.ts';

/** Mounts fight as real monsters, tame from real ones, and are ridden with a real skill. */
export function mountReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  const rules = content.mountRules;
  for (const t of rules.mounts) {
    const where = `mountRules/${t.id}`;
    if (!monsters.has(t.monster)) errors.push(`${where}: unknown monster ${t.monster}`);
    for (const id of t.tameFrom)
      if (!monsters.has(id)) errors.push(`${where}: tames from unknown monster ${id}`);
    if (t.role === 'pack' ? t.riderSizes.length > 0 : t.riderSizes.length === 0)
      errors.push(`${where}: ${t.role === 'pack' ? 'a pack mount has no riders' : 'needs riders'}`);
    if (t.loadRidden > t.loadUnridden) errors.push(`${where}: carries more ridden than unridden`);
  }
  const tamed = rules.mounts.flatMap((t) => t.tameFrom);
  for (const id of new Set(tamed.filter((id, i) => tamed.indexOf(id) !== i)))
    errors.push(`mountRules: ${id} tames into more than one mount`);
  if (!gameSkills(srd, content).some((s) => s.id === rules.ride.skill))
    errors.push(`mountRules/ride: unknown skill ${rules.ride.skill}`);
  return errors;
}
