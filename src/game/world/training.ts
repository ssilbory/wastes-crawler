// Leveling, training, preparing spells, and class switching happen in town
// (docs/rules-adaptation.md, Class switching; Towns in Phase 6a).
import { shiftCharacter } from '../character/shift.ts';
import type { Character } from '../../data/schemas/index.ts';
import { advance, type LevelChoices } from '../character/advance.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import type { TrainResult } from '../character/training.ts';
import { untoughened } from './companion-sync.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';
import { townHere } from './town-prices.ts';

function living(w: World, data: GameData, id: string): Member {
  townHere(w, data);
  const m = w.members.find((x) => x.id === id && !x.dead);
  if (!m) throw new Error(`no living party member ${id}`);
  return m;
}

/** Levels and training happen in the member's own shape, so a form's hit points stay out of them. */
const ownShape = (data: GameData, m: Member) =>
  m.form === null ? m.character : shiftCharacter(data, m.character, m.form, null);

/** Puts the worn form back on the trained character. */
const reshape = (data: GameData, m: Member, c: Character) =>
  m.form === null ? c : shiftCharacter(data, c, null, m.form);

export function levelUpMember(
  w: World,
  data: GameData,
  id: string,
  choices: LevelChoices,
): TownResult {
  const m = living(w, data, id);
  const result = untoughened(w, data, m, () => {
    const r = advance(data, ownShape(data, m), choices, w.rng);
    if (r.ok) m.character = reshape(data, m, r.character);
    return r;
  });
  if (!result.ok) return result;
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
  const result = untoughened(w, data, m, () => {
    const r = step(ownShape(data, m));
    if (r.ok) m.character = reshape(data, m, r.character);
    return r;
  });
  return result.ok ? { ok: true } : result;
}
