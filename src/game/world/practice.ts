// Practicing forms in town (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.15 The
// Skinshifter.md): new forms are free; reshaping kept ones takes a day.
import type { Form } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { formProblem } from '../character/forms.ts';
import { note } from './members.ts';
import { stayAtInn, type TownResult } from './services.ts';
import type { World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The same form, whatever order its arts were picked in. */
const same = (a: Form, b: Form | undefined) =>
  !!b &&
  a.name === b.name &&
  a.humanoid === b.humanoid &&
  a.feral === b.feral &&
  [...a.arts].sort().join() === [...b.arts].sort().join();

/**
 * Keeps a new set of forms. A form in an empty slot is free; reshaping or dropping one already kept
 * takes a day of careful practice (1.5.15), spent as a night at the inn.
 */
export function setForms(w: World, data: GameData, memberId: string, forms: Form[]): TownResult {
  const m = w.members.find((x) => x.id === memberId && !x.dead);
  if (!m) return no('No one is here to practice.');
  const problem = formProblem(data, m.character, forms);
  if (problem) return no(`${problem.charAt(0).toUpperCase()}${problem.slice(1)}.`);
  const kept = m.character.forms ?? [];
  if (kept.some((f, i) => !same(f, forms[i]))) {
    const stay = stayAtInn(w, data);
    if (!stay.ok) return stay;
    note(w, `${m.character.name} spends the day reshaping their forms.`);
  }
  m.character = { ...m.character, forms };
  return { ok: true };
}
