// What changing form does to a character's hit points (vendor/wwn-srd/1.0 Character Creation/
// 1.5.0 Class List/1.5.15 The Skinshifter.md, Feral Prowess).
import type { Character } from '../../data/schemas/index.ts';
import { shiftedHp } from '../../rules/forms.ts';
import type { GameData } from './context.ts';
import { characterSheet } from './derived.ts';

/** The character after shifting from one form to another; null is their own shape. */
export function shiftCharacter(
  data: GameData,
  c: Character,
  from: number | null,
  to: number | null,
): Character {
  const before = characterSheet(c, data, from);
  const after = characterSheet(c, data, to);
  const hp = shiftedHp(c.hp, after.level, after.modifiers.con - before.modifiers.con);
  return hp.max === c.hp.max ? c : { ...c, hp };
}
