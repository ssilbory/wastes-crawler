// The game's spell list (docs/rules-adaptation.md, High Magic in combat): the SRD's
// (vendor/wwn-srd/4.0 Magic and Spellcasting/) plus the spells the game adds, such as the
// Elementalist's tree spells.
import type { ContentData, Spell, SrdData } from './schemas/index.ts';

export type GameSpell = Omit<Spell, 'source'>;

export function gameSpells(srd: SrdData, content: ContentData): GameSpell[] {
  return [...srd.spells, ...content.spellRules.added];
}

/** Added spells may not share an SRD spell's id; the excluded and outside lists name real spells. */
export function spellRuleErrors(srd: SrdData, content: ContentData): string[] {
  const srdIds = new Set(srd.spells.map((s) => s.id));
  const ids = new Set(gameSpells(srd, content).map((s) => s.id));
  const rules = content.spellRules;
  return [
    ...rules.added
      .filter((s) => srdIds.has(s.id))
      .map((s) => `spellRules/added/${s.id}: clashes with an SRD spell`),
    ...(['excluded', 'outsideCombat'] as const).flatMap((list) =>
      rules[list]
        .filter((id) => !ids.has(id))
        .map((id) => `spellRules/${list}: unknown spell ${id}`),
    ),
  ];
}
