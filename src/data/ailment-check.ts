import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Every disease a terrain, dungeon level, trap, or monster strike names exists, disease ids are
 * unique, and the antidote's id is free of the SRD's gear.
 */
export function ailmentReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const ids = content.ailments.diseases.map((d) => d.id);
  const known = new Set(ids);
  if (known.size !== ids.length) errors.push('ailments: duplicate disease ids');
  const check = (where: string, id: string) => {
    if (!known.has(id)) errors.push(`${where}: unknown disease ${id}`);
  };
  for (const t of content.terrains)
    if (t.exposure) check(`terrains/${t.id} exposure`, t.exposure.disease);
  for (const d of content.dungeons)
    for (const l of d.levels) {
      if (l.exposure) check(`dungeons/${d.id}/${l.id} exposure`, l.exposure.disease);
      for (const trap of l.traps)
        if (trap.effect.kind === 'disease')
          check(`dungeons/${d.id}/${l.id} trap`, trap.effect.disease);
    }
  for (const m of content.monsterCombat)
    for (const s of m.routine ?? [])
      if (s.onHit?.kind === 'disease') check(`monsterCombat/${m.id} ${s.name}`, s.onHit.disease);
  if (srd.gear.some((g) => g.id === content.ailments.antidote.id))
    errors.push(`ailments: the antidote's id ${content.ailments.antidote.id} is SRD gear`);
  return errors;
}
