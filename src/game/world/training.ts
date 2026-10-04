// Leveling, training, preparing spells, and class switching happen in town
// (docs/rules-adaptation.md, Class switching; Towns in Phase 6a).
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

export function levelUpMember(
  w: World,
  data: GameData,
  id: string,
  choices: LevelChoices,
): TownResult {
  const m = living(w, data, id);
  const result = advance(data, m.character, choices, w.rng);
  if (!result.ok) return result;
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
  const result = step(m.character);
  if (!result.ok) return result;
  m.character = result.character;
  return { ok: true };
}
