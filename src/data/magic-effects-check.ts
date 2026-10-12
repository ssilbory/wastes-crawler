import type { ContentData, SrdData } from './schemas/index.ts';
import { gameSpells } from './spells.ts';

/**
 * Every spell and art the game offers has an in-game effect line, and each line names a real spell
 * or art. Spells in spellRules.excluded and a tradition's excludedArts need none.
 */
export function magicEffectErrors(srd: SrdData, content: ContentData): string[] {
  const { spells, arts } = content.magicEffects;
  const excludedSpells = new Set(content.spellRules.excluded);
  const excludedArts = new Set(content.traditions.flatMap((t) => t.excludedArts));
  const spellIds = gameSpells(srd, content).map((s) => s.id);
  const artIds = srd.arts.map((a) => a.id);
  return [
    ...Object.keys(spells)
      .filter((id) => !spellIds.includes(id))
      .map((id) => `magicEffects/spells: unknown spell ${id}`),
    ...Object.keys(arts)
      .filter((id) => !artIds.includes(id))
      .map((id) => `magicEffects/arts: unknown art ${id}`),
    ...spellIds
      .filter((id) => !excludedSpells.has(id) && !(id in spells))
      .map((id) => `magicEffects/spells: no line for ${id}`),
    ...artIds
      .filter((id) => !excludedArts.has(id) && !(id in arts))
      .map((id) => `magicEffects/arts: no line for ${id}`),
  ];
}
