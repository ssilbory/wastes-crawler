import type { ContentData, SrdData } from './schemas/index.ts';

/** Ammo is SRD gear, shot by real shooting weapons, each weapon taking one kind of ammo. */
export function ammoReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  // A weapon with a range that isn't thrown is shot (src/game/character/equipment.ts).
  const shooters = new Set(
    srd.weapons.filter((w) => w.range && !w.traits.includes('throwable')).map((w) => w.id),
  );
  const owner = new Map<string, string>();
  for (const [id, ammo] of Object.entries(content.equipmentRules.ammo)) {
    if (!srd.gear.some((g) => g.id === id)) errors.push(`equipmentRules/ammo: unknown gear ${id}`);
    for (const w of ammo.weapons) {
      if (!shooters.has(w)) errors.push(`equipmentRules/ammo/${id}: ${w} isn't a shooting weapon`);
      if (owner.has(w))
        errors.push(`equipmentRules/ammo/${id}: ${w} already shoots ${owner.get(w)}`);
      owner.set(w, id);
    }
  }
  return errors;
}
