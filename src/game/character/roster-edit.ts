// Editing saved characters (docs/rules-adaptation.md, Editing saved characters). A character
// made in the builder keeps its picks and opens in the builder again; an unlevelled one without
// picks opens with what its sheet shows; a levelled one can only change its name and goal. Saving
// under the same name overwrites it, and under another name adds a new character.
import type { Character } from '../../data/schemas/index.ts';
import { attributeModifier } from '../../rules/attributes.ts';
import { characterLevel } from '../../rules/progression.ts';
import { createRng, type Rng } from '../../rules/rng.ts';
import { FREE_REROLLS, isStandardArray } from './attributes.ts';
import { emptyChoices, MAX_GOAL, MAX_NAME, type Choices } from './choices.ts';
import type { GameData } from './context.ts';
import { finishCharacter, newCharacterId } from './creation.ts';
import { addToRoster, type RosterEntry } from './roster.ts';

/** How a saved character opens; `recovered` says why its picks were rebuilt from the sheet. */
export type EditPlan =
  { kind: 'wizard'; choices: Choices; recovered: null | 'missing' | 'stale' } | { kind: 'details' };

export const sameName = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The character with its rolled parts blanked, for comparing two builds. */
const unrolled = (c: Character) => JSON.stringify({ ...c, id: '', hp: null });

/** Whether the picks still build this character, ignoring its id and HP roll. */
function buildsSame(choices: Choices, c: Character, data: GameData): boolean {
  const built = finishCharacter(choices, data, createRng('edit'));
  return built.ok && unrolled(built.character) === unrolled(c);
}

/** The builder picks a sheet shows: people, attributes, background, class, forms, name, goal. */
export function recoverChoices(c: Character): Choices {
  const base = c.attributes.base;
  return {
    ...emptyChoices(),
    people: c.people,
    lineage: c.lineage ?? null,
    array: base,
    // Scores off the standard array are kept as named scores, the only method that takes any six.
    attributeMethod: isStandardArray(base)
      ? { kind: 'array' }
      : { kind: 'manual', rerolls: FREE_REROLLS + 1 },
    background: { id: c.background, choice: { mode: 'pick', picks: [] } },
    classId: c.classes.current,
    ...(c.forms ? { forms: c.forms } : {}),
    name: c.name,
    goal: c.goal,
  };
}

export function editPlan(entry: RosterEntry, data: GameData): EditPlan {
  const c = entry.character;
  if (entry.choices && buildsSame(entry.choices, c, data))
    return { kind: 'wizard', choices: entry.choices, recovered: null };
  if (c.xp === 0 && characterLevel(c.classes) === 1) {
    const recovered = entry.choices ? 'stale' : 'missing';
    return { kind: 'wizard', choices: recoverChoices(c), recovered };
  }
  return { kind: 'details' };
}

/** The Constitution modifier starting HP was rolled with; foci bonuses are compared separately. */
const conModifier = (c: Character) =>
  attributeModifier(
    Object.values(c.attributes).reduce((sum, adjust) => sum + (adjust.con ?? 0), 0),
  );

/**
 * HP is kept over an edit unless what it was rolled from changed: the class's hit die, the Con
 * modifier, or foci such as Die Hard (vendor/wwn-srd/1.0 Character Creation/1.7.0 Final Character
 * Creation Steps.md, 1.7.1).
 */
const sameHpRoll = (a: Character, b: Character) =>
  a.classes.current === b.classes.current &&
  conModifier(a) === conModifier(b) &&
  JSON.stringify(a.foci) === JSON.stringify(b.foci);

/**
 * The character a build saves as: under the original's name it is the original, keeping its id,
 * and its HP unless what HP was rolled from changed.
 */
export function asEdit(original: RosterEntry | undefined, built: Character): Character {
  if (!original || !sameName(original.character.name, built.name)) return built;
  const old = original.character;
  return { ...built, id: old.id, hp: sameHpRoll(old, built) ? old.hp : built.hp };
}

/** Saves a character from the builder: over `original` if the name is unchanged, else as new. */
export function saveBuilt(
  entries: readonly RosterEntry[],
  built: Character,
  choices: Choices,
  original?: RosterEntry,
): RosterEntry[] {
  if (!original || !sameName(original.character.name, built.name))
    return addToRoster(entries, built, choices);
  const character = asEdit(original, built);
  // Deleted meanwhile, as from another tab: the edit comes back as a new character.
  if (!entries.some((e) => e.id === original.id)) return addToRoster(entries, character, choices);
  return entries.map((e) => (e.id === original.id ? { ...e, character, choices } : e));
}

/** Adds an imported character, under a fresh character id if one in the roster already has it. */
export function importToRoster(
  entries: readonly RosterEntry[],
  character: Character,
  rng: Rng,
): RosterEntry[] {
  const taken = entries.some((e) => e.character.id === character.id);
  return addToRoster(entries, taken ? { ...character, id: newCharacterId(rng) } : character);
}

export type DetailsResult = { ok: true; entries: RosterEntry[] } | { ok: false; reason: string };

/** Saves a new name and goal: over `original` if the name is unchanged, else as a copy. */
export function saveDetails(
  entries: readonly RosterEntry[],
  original: RosterEntry,
  details: { name: string; goal: string },
  rng: Rng,
): DetailsResult {
  const name = details.name.trim();
  if (name === '') return { ok: false, reason: 'A character needs a name.' };
  if (name.length > MAX_NAME) return { ok: false, reason: `Names run to ${MAX_NAME} letters.` };
  if (details.goal.length > MAX_GOAL)
    return { ok: false, reason: `Goals run to ${MAX_GOAL} letters.` };
  const character = { ...original.character, name, goal: details.goal };
  if (!sameName(original.character.name, name))
    return {
      ok: true,
      entries: addToRoster(entries, { ...character, id: newCharacterId(rng) }),
    };
  if (!entries.some((e) => e.id === original.id))
    return { ok: true, entries: addToRoster(entries, character) };
  // The old picks built the old name and goal, so they no longer match.
  const entry: RosterEntry = { id: original.id, defaultAction: original.defaultAction, character };
  return { ok: true, entries: entries.map((e) => (e.id === original.id ? entry : e)) };
}
