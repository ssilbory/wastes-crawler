import type { BonusSkill, ContentData, SrdData } from './schemas/index.ts';
import { gameSkills } from './skills.ts';

/** Most racial foci a character has: signature foci plus fill-in picks (docs/rules-adaptation.md). */
export const RACIAL_FOCI = 3;

function bonusSkillIds(b: BonusSkill | undefined): string[] {
  if (!b) return [];
  if (b.kind === 'skill') return [b.skill];
  if (b.kind === 'one-of') return b.skills;
  if (b.kind === 'any-except') return b.except;
  return [];
}

/** Focus rules cover every SRD focus once; racial foci and pick lists reference real foci. */
export function focusReferenceErrors(srd: SrdData, content: ContentData): string[] {
  const errors: string[] = [];
  const skills = new Set(gameSkills(srd, content).map((s) => s.id));
  const srdFoci = new Set(srd.foci.map((f) => f.id));
  const racial = new Set(content.racialFoci.map((f) => f.id));
  const ruled = new Set(content.focusRules.map((r) => r.id));
  const pickable = new Set(
    content.focusRules.filter((r) => r.availability === 'pickable').map((r) => r.id),
  );

  for (const r of content.focusRules) {
    if (!srdFoci.has(r.id)) errors.push(`focusRules/${r.id}: not an SRD focus`);
  }
  for (const id of srdFoci) {
    if (!ruled.has(id)) errors.push(`focusRules: no rule for SRD focus ${id}`);
  }
  for (const f of [...content.focusRules, ...content.racialFoci]) {
    for (const s of bonusSkillIds(f.bonusSkill)) {
      if (!skills.has(s)) errors.push(`foci/${f.id}: unknown bonus skill ${s}`);
    }
  }
  for (const id of racial) {
    if (srdFoci.has(id)) errors.push(`racialFoci/${id}: clashes with an SRD focus id`);
  }

  for (const p of content.peoples) {
    const variants = p.lineages
      ? p.lineages.map((l) => ({ where: `${p.id}/${l.id}`, extra: l.signatureFoci }))
      : [{ where: p.id, extra: [] as string[] }];
    for (const v of variants) {
      const signature = [...p.signatureFoci, ...v.extra];
      for (const id of signature) {
        if (!racial.has(id)) errors.push(`peoples/${v.where}: unknown racial focus ${id}`);
      }
      if (signature.length < 1 || signature.length > RACIAL_FOCI) {
        errors.push(`peoples/${v.where}: needs 1 to ${RACIAL_FOCI} signature foci`);
      }
      if (p.racialFocusPicks.length < RACIAL_FOCI - signature.length) {
        errors.push(`peoples/${v.where}: too few racial focus picks`);
      }
    }
    for (const id of p.racialFocusPicks) {
      if (!pickable.has(id)) errors.push(`peoples/${p.id}: ${id} isn't a pickable SRD focus`);
    }
  }
  return errors;
}
