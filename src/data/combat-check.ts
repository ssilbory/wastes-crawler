import type { ContentData, SrdData } from './schemas/index.ts';

/** Every monster has combat data, Wpn monsters name a real weapon, and magic effects exist. */
export function combatReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const weapons = new Set(srd.weapons.map((w) => w.id));
  const skills = new Set(srd.skills.map((s) => s.id));
  for (const m of srd.monsters) {
    const c = content.monsterCombat.find((x) => x.id === m.id);
    if (!c) errors.push(`monsterCombat: no entry for ${m.id}`);
    else if (m.damage.kind === 'weapon' && !c.weapon)
      errors.push(`monsterCombat/${m.id}: needs a weapon`);
  }
  for (const c of content.monsterCombat) {
    if (!srd.monsters.some((m) => m.id === c.id))
      errors.push(`monsterCombat/${c.id}: unknown monster`);
    if (c.weapon && !weapons.has(c.weapon))
      errors.push(`monsterCombat/${c.id}: unknown weapon ${c.weapon}`);
  }
  for (const m of content.combatMagic) {
    const known = m.source === 'spell' ? srd.spells : srd.arts;
    if (!known.some((k) => k.id === m.id)) errors.push(`combatMagic/${m.id}: unknown ${m.source}`);
    const e = m.effect;
    const skill = e.kind === 'blast' ? e.skill : e.kind === 'enthrall' ? e.penaltySkill : undefined;
    if (skill !== undefined && !skills.has(skill)) {
      errors.push(`combatMagic/${m.id}: unknown skill ${skill}`);
    }
  }
  return errors;
}
