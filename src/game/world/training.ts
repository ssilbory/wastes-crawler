// Leveling, training, preparing spells, and class switching happen in town
// (docs/rules-adaptation.md, Class switching; Towns in Phase 6a).
import { shiftCharacter } from '../character/shift.ts';
import type { Character } from '../../data/schemas/index.ts';
import { advance, type LevelChoices } from '../character/advance.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import type { TrainResult } from '../character/training.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { townHere } from './town.ts';
import type { Member, World } from './types.ts';

function living(w: World, data: GameData, id: string): Member {
  townHere(w, data);
  const m = w.members.find((x) => x.id === id && !x.dead);
  if (!m) throw new Error(`no living party member ${id}`);
  return m;
}

/** Levels and training happen in the member's own shape, so a form's hit points stay out of them. */
const ownShape = (data: GameData, m: Member) =>
  m.form === null ? m.character : shiftCharacter(data, m.character, m.form, null);

export function levelUpMember(
  w: World,
  data: GameData,
  id: string,
  choices: LevelChoices,
): TownResult {
  const m = living(w, data, id);
  const result = advance(data, ownShape(data, m), choices, w.rng);
  if (!result.ok) return result;
  m.form = null;
  m.character = result.character;
  const level = characterSheet(m.character, data).level;
  note(w, `${m.character.name} reaches level ${level} (${m.character.hp.max} HP).`);
  return { ok: true };
}

/** Applies a training step (a skill, an attribute, prepared spells, or a class switch). */
export function trainMember(
  w: World,
  data: GameData,
  id: string,
  step: (c: Character) => TrainResult,
): TownResult {
  const m = living(w, data, id);
  const result = step(ownShape(data, m));
  if (!result.ok) return result;
  m.form = null;
  m.character = result.character;
  return { ok: true };
}
