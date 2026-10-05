// The game's skill list (docs/rules-adaptation.md, Skills): the SRD's
// (vendor/wwn-srd/1.0 Character Creation/1.2.0 Skills.md) less the skills the game has no use for
// yet, plus the skills it adds.
import type { ContentData, SrdData } from './schemas/index.ts';

export interface GameSkill {
  id: string;
  name: string;
  description: string;
}

export function gameSkills(srd: SrdData, content: ContentData): GameSkill[] {
  const removed = new Set(content.skillRules.removed.map((r) => r.id));
  return [...srd.skills.filter((s) => !removed.has(s.id)), ...content.skillRules.added];
}

/** Problems with the skill changes themselves. */
export function skillRuleErrors(srd: SrdData, content: ContentData): string[] {
  const srdIds = new Set(srd.skills.map((s) => s.id));
  const game = new Set(gameSkills(srd, content).map((s) => s.id));
  const errors: string[] = [];
  for (const r of content.skillRules.removed) {
    if (!srdIds.has(r.id)) errors.push(`skillRules/removed/${r.id}: not an SRD skill`);
    if (!game.has(r.becomes)) errors.push(`skillRules/removed/${r.id}: unknown skill ${r.becomes}`);
  }
  for (const a of content.skillRules.added) {
    if (srdIds.has(a.id)) errors.push(`skillRules/added/${a.id}: clashes with an SRD skill`);
  }
  if (!game.has(content.skillRules.animalKen.skill))
    errors.push(`skillRules/animalKen: unknown skill ${content.skillRules.animalKen.skill}`);
  return errors;
}
