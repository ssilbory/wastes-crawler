// The saved-character roster (docs/plan.md, Save/load: character saves to browser storage start
// with the arena). Pure functions; the UI owns the storage itself.
import {
  ROSTER_SCHEMA_VERSION,
  RosterSchema,
  type Character,
  type DefaultPreset,
} from '../../data/schemas/index.ts';
import type { GameData } from './context.ts';
import { importCharacter } from './io.ts';

export interface RosterEntry {
  id: string;
  character: Character;
  defaultAction: DefaultPreset;
}

export interface LoadedRoster {
  entries: RosterEntry[];
  /** Entries that no longer load, such as after a content change; they are dropped. */
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
    if (result.ok) entries.push({ ...e, character: result.character });
    else errors.push(`${e.id}: ${result.errors.join('; ')}`);
  }
  return { entries, errors };
}

/** Adds a character under a fresh id, the name plus a counter when the name is taken. */
export function addToRoster(entries: readonly RosterEntry[], character: Character): RosterEntry[] {
  const base =
    character.name
      .trim()
      .toLowerCase()
      .replace(/[^\w]+/g, '-') || 'character';
  let id = base;
  for (let n = 2; entries.some((e) => e.id === id); n++) id = `${base}-${n}`;
  return [...entries, { id, character, defaultAction: 'auto' }];
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
