import { allMonsters } from './monsters.ts';
import type { ContentData, SrdData } from './schemas/index.ts';

/** Components drop from real monsters, and every component type a mod needs exists. */
export function craftingReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const monsters = new Set(allMonsters(srd, content).map((m) => m.id));
  for (const c of content.components)
    for (const s of c.sources)
      if (!monsters.has(s.monster)) errors.push(`components/${c.id}: unknown monster ${s.monster}`);
  const types = new Set(content.components.map((c) => c.type));
  for (const m of content.mods)
    for (const need of m.components)
      if (!types.has(need.type)) errors.push(`mods/${m.id}: no component is ${need.type}`);
  return errors;
}
