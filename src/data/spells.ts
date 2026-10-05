// The game's spell list (docs/rules-adaptation.md, High Magic in combat): the SRD's
// (vendor/wwn-srd/4.0 Magic and Spellcasting/) plus the spells the game adds, such as the
// Elementalist's tree spells.
import type { ContentData, Spell, SrdData } from './schemas/index.ts';

export type GameSpell = Omit<Spell, 'source'>;

export function gameSpells(srd: SrdData, content: ContentData): GameSpell[] {
  return [...srd.spells, ...content.spellRules.added];
}

/** Problems with the added spells: none may share an SRD spell's id. */
export function spellRuleErrors(srd: SrdData, content: ContentData): string[] {
  const ids = new Set(srd.spells.map((s) => s.id));
  return content.spellRules.added
    .filter((s) => ids.has(s.id))
    .map((s) => `spellRules/added/${s.id}: clashes with an SRD spell`);
}
