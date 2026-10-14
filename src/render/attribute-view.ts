// How an attribute reads where a player picks one to raise (a boost, a focus's attribute, or
// Boneshaper): its name with the character's score and modifier now, so the choice shows what
// it changes. Modifiers include focus bonuses and shaping, as the sheet shows them.
import type { Attribute, Character } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { signed } from './attack-view.ts';

/** "Strength 14 (+1)". */
export function attributeLabel(
  data: GameData,
  c: Character,
  attribute: Attribute,
  name: string,
): string {
  const sheet = characterSheet(c, data);
  return `${name} ${sheet.scores[attribute]} (${signed(sheet.modifiers[attribute])})`;
}
