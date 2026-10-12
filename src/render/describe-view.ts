// What spells, arts, and foci do, for hover text on the character sheet and at level-up (Sam's
// call), from their SRD and content text. Spells and arts end with a line on what they do in this
// game (data/content/magic-effects.json).
import { gameSpells } from '../data/spells.ts';
import type { GameData } from '../game/character/context.ts';
import { findTradition } from '../game/character/class-step.ts';
import { focusInfo } from '../game/character/foci.ts';

const TRADITIONS = {
  'high-magic': 'High Magic',
  elementalist: 'Elementalist',
  necromancer: 'Necromancer',
};

/** "\nIn game: Kills plant creatures." for a spell or art with an effect line, else empty. */
function effectLine(line: string | undefined): string {
  return line ? `\nIn game: ${line}` : '';
}

/** "Level 1 High Magic. The mage designates…", or empty for an unknown spell. */
export function spellHint(data: GameData, id: string): string {
  const s = gameSpells(data.srd, data.content).find((x) => x.id === id);
  if (!s) return '';
  const line = effectLine(data.content.magicEffects.spells[id]);
  return `Level ${s.level} ${TRADITIONS[s.tradition]}. ${s.text}${line}`;
}

/** The game's own text for an art it reworks, else the SRD's; empty for an unknown art. */
export function artHint(data: GameData, id: string): string {
  const art = data.srd.arts.find((a) => a.id === id);
  if (!art) return '';
  const text = findTradition(data, art.tradition)?.artText[id] ?? art.text;
  return text + effectLine(data.content.magicEffects.arts[id]);
}

/** The focus's description and each level's text, up to `upTo` levels when given. */
export function focusHint(data: GameData, id: string, upTo?: number): string {
  const f = focusInfo(data, id);
  if (!f) return '';
  const levels = f.levels.filter((l) => upTo === undefined || l.level <= upTo);
  return [f.description, ...levels.map((l) => `Level ${l.level}: ${l.text}`)].join('\n');
}
