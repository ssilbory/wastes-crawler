import type { ContentData, SrdData } from './schemas/index.ts';
import { gameSkills } from './skills.ts';
import { gameSpells } from './spells.ts';

/**
 * Class options and traditions reference real progressions, casting tables, skills, arts, and
 * spells; a tradition's level-gated arts are its own.
 */
export function magicReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const skills = new Set(gameSkills(srd, content).map((s) => s.id));
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
  errors.push(...artSupplyErrors(srd, content));
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
      if (!gameSpells(srd, content).some((s) => s.id === id))
        errors.push(`classOptions/${c.id}: unknown excluded spell ${id}`);
    }
  }
  return errors;
}

/**
 * Every arts table a class uses offers enough open arts for its picks through 10th level: at each
 * level, the picks so far fit within the tradition's arts that aren't excluded, granted outright,
 * or waiting for a later level (Phase 15).
 */
function artSupplyErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const pairs = new Map<string, { tradition: string; table: string }>();
  for (const c of content.classOptions)
    for (const t of c.mage?.traditions ?? [])
      pairs.set(`${t.tradition}/${t.arts}`, { tradition: t.tradition, table: t.arts });
  for (const { tradition, table } of pairs.values()) {
    const t = content.traditions.find((x) => x.id === tradition);
    const rows = srd['casting-progressions'].find((x) => x.id === table)?.levels;
    if (!t || !rows) continue;
    const granted = new Set(rows.flatMap((r) => r.arts));
    let picks = 0;
    for (const row of rows) {
      picks += row.anyArts;
      const open = srd.arts.filter(
        (a) =>
          a.tradition === tradition &&
          !granted.has(a.id) &&
          !t.excludedArts.includes(a.id) &&
          (t.artLevels[a.id] ?? 1) <= row.level,
      ).length;
      if (picks > open)
        errors.push(
          `traditions/${tradition}: ${table} needs ${picks} arts by level ${row.level}, ${open} open`,
        );
    }
  }
  return errors;
}
