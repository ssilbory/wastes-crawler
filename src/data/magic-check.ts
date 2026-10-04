import type { ContentData, SrdData } from './schemas/index.ts';

/**
 * Class options and traditions reference real progressions, casting tables, skills, arts, and
 * spells; a tradition's level-gated arts are its own.
 */
export function magicReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const skills = new Set(srd.skills.map((s) => s.id));
  const progressions = new Set(srd.progressions.map((p) => p.id));
  const casting = new Set(srd['casting-progressions'].map((c) => c.id));
  const traditions = new Set(content.traditions.map((t) => t.id));
  for (const t of content.traditions) {
    for (const s of [t.bonusSkill, ...t.effort.skills]) {
      if (!skills.has(s)) errors.push(`traditions/${t.id}: unknown skill ${s}`);
    }
    if (!srd.arts.some((a) => a.tradition === t.id)) errors.push(`traditions/${t.id}: has no arts`);
    for (const art of [...Object.keys(t.artLevels), ...t.excludedArts]) {
      if (!srd.arts.some((a) => a.id === art && a.tradition === t.id))
        errors.push(`traditions/${t.id}: ${art} isn't one of its arts`);
    }
  }
  for (const c of content.classOptions) {
    if (!progressions.has(c.id)) errors.push(`classOptions/${c.id}: unknown progression`);
    if (!c.mage) continue;
    if (!casting.has(c.mage.slots)) {
      errors.push(`classOptions/${c.id}: unknown casting table ${c.mage.slots}`);
    }
    for (const t of c.mage.traditions) {
      if (!traditions.has(t.tradition)) {
        errors.push(`classOptions/${c.id}: unknown tradition ${t.tradition}`);
      }
      if (!casting.has(t.arts))
        errors.push(`classOptions/${c.id}: unknown casting table ${t.arts}`);
    }
    for (const id of c.mage.excludedSpells) {
      if (!srd.spells.some((s) => s.id === id))
        errors.push(`classOptions/${c.id}: unknown excluded spell ${id}`);
    }
  }
  return errors;
}
