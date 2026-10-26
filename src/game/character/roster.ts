// The saved-character roster (docs/plan.md, Save/load: character saves to browser storage start
// with the arena). Pure functions; the UI owns the storage itself.
import {
  ChoicesSchema,
  ROSTER_SCHEMA_VERSION,
  RosterSchema,
  type Character,
  type DefaultPreset,
} from '../../data/schemas/index.ts';
import type { Choices } from './choices.ts';
import type { GameData } from './context.ts';
import { importCharacter } from './io.ts';

/** Stored builder picks, or null if there are none or they no longer fit the shape. */
function parseChoices(raw: unknown): Choices | null {
  const parsed = ChoicesSchema.safeParse(raw);
  return parsed.success ? parsed.data : null;
}

export interface RosterEntry {
  id: string;
  character: Character;
  defaultAction: DefaultPreset;
  /** The builder's picks, for characters made in it. */
  choices?: Choices;
}

export interface LoadedRoster {
  entries: RosterEntry[];
  /** Entries that no longer load, such as after a content change; saving keeps them as they were. */
  errors: string[];
}

export function serializeRoster(entries: readonly RosterEntry[]): string {
  return JSON.stringify({ version: ROSTER_SCHEMA_VERSION, entries });
}

/** Reads a stored roster; a missing or unreadable roster is empty, with the reason in errors. */
export function parseRoster(text: string | null, data: GameData): LoadedRoster {
  if (text === null) return { entries: [], errors: [] };
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch {
    return { entries: [], errors: ['the saved roster is not valid JSON'] };
  }
  const parsed = RosterSchema.safeParse(raw);
  if (!parsed.success) return { entries: [], errors: ['the saved roster is damaged'] };
  const entries: RosterEntry[] = [];
  const errors: string[] = [];
  for (const e of parsed.data.entries) {
    const result = importCharacter(JSON.stringify(e.character), data);
    if (!result.ok) {
      errors.push(`${e.id}: ${result.errors.join('; ')}`);
      continue;
    }
    const choices = parseChoices(e.choices);
    entries.push({
      id: e.id,
      defaultAction: e.defaultAction,
      character: result.character,
      ...(choices ? { choices } : {}),
    });
  }
  return { entries, errors };
}

export interface RosterSave {
  text: string;
  /** A stored roster that couldn't be read at all, to keep aside rather than lose. */
  backup: string | null;
}

/**
 * What to store for these entries over the stored roster: entries that no longer load stay as they
 * were (under a fresh id if another took theirs), so a content change never erases a character. A
 * roster of another shape keeps every stored entry too, and its text is set aside as well.
 */
export function rosterToSave(
  stored: string | null,
  entries: readonly RosterEntry[],
  data: GameData,
): RosterSave {
  let raw: unknown = null;
  try {
    raw = stored === null ? null : JSON.parse(stored);
  } catch {
    // Unreadable text is kept aside below.
  }
  const parsed = RosterSchema.safeParse(raw);
  const stray = (raw as { entries?: unknown } | null)?.entries;
  const old: { id?: unknown; character?: unknown }[] = parsed.success
    ? parsed.data.entries.filter((e) => !importCharacter(JSON.stringify(e.character), data).ok)
    : Array.isArray(stray)
      ? (stray as { id?: unknown }[])
      : [];
  const ids = new Set(entries.map((e) => e.id));
  const kept = old.map((e) => {
    let id = typeof e.id === 'string' ? e.id : 'unreadable';
    while (ids.has(id)) id = `${id}-unreadable`;
    ids.add(id);
    return { ...e, id };
  });
  return {
    text: JSON.stringify({ version: ROSTER_SCHEMA_VERSION, entries: [...entries, ...kept] }),
    backup: parsed.success ? null : stored,
  };
}

/** Adds a character under a fresh id, the name plus a counter when the name is taken. */
export function addToRoster(
  entries: readonly RosterEntry[],
  character: Character,
  choices?: Choices,
): RosterEntry[] {
  const base =
    character.name
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, '-') || 'character';
  let id = base;
  for (let n = 2; entries.some((e) => e.id === id); n++) id = `${base}-${n}`;
  return [...entries, { id, character, defaultAction: 'auto', ...(choices ? { choices } : {}) }];
}

export function removeFromRoster(entries: readonly RosterEntry[], id: string): RosterEntry[] {
  return entries.filter((e) => e.id !== id);
}

export function setDefaultAction(
  entries: readonly RosterEntry[],
  id: string,
  preset: DefaultPreset,
): RosterEntry[] {
  return entries.map((e) => (e.id === id ? { ...e, defaultAction: preset } : e));
}

/**
 * Adds the content's starter party, reusing any member already in the roster unchanged, and
 * returns the formation placement for setting out with it (row-column key to roster id).
 */
export function addStarterParty(
  entries: readonly RosterEntry[],
  data: GameData,
): { entries: RosterEntry[]; placement: Record<string, string> } {
  let next = [...entries];
  const placement: Record<string, string> = {};
  for (const s of data.content.starterParty) {
    // Loaded the way a stored roster is, so a starter added before compares equal.
    const loaded = importCharacter(JSON.stringify(s.character), data);
    if (!loaded.ok) throw new Error(`starter ${s.character.name}: ${loaded.errors.join('; ')}`);
    const same = JSON.stringify(loaded.character);
    let entry = next.find((e) => JSON.stringify(e.character) === same);
    if (!entry) {
      next = addToRoster(next, loaded.character);
      entry = next.at(-1) as RosterEntry;
    }
    placement[`${s.row}-${s.column}`] = entry.id;
  }
  return { entries: next, placement };
}
