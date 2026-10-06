// What spells, arts, and foci do, for hover text on the character sheet and at level-up (Sam's
// call), from their SRD and content text.
import { gameSpells } from '../data/spells.ts';
import type { GameData } from '../game/character/context.ts';
import { focusInfo } from '../game/character/foci.ts';

const TRADITIONS = {
  'high-magic': 'High Magic',
  elementalist: 'Elementalist',
  necromancer: 'Necromancer',
};

/** "Level 1 High Magic. The mage designates…", or empty for an unknown spell. */
export function spellHint(data: GameData, id: string): string {
  const s = gameSpells(data.srd, data.content).find((x) => x.id === id);
  return s ? `Level ${s.level} ${TRADITIONS[s.tradition]}. ${s.text}` : '';
}

export function artHint(data: GameData, id: string): string {
  return data.srd.arts.find((a) => a.id === id)?.text ?? '';
}

/** The focus's description and each level's text, up to `upTo` levels when given. */
export function focusHint(data: GameData, id: string, upTo?: number): string {
  const f = focusInfo(data, id);
  if (!f) return '';
  const levels = f.levels.filter((l) => upTo === undefined || l.level <= upTo);
  return [f.description, ...levels.map((l) => `Level ${l.level}: ${l.text}`)].join('\n');
}
