// Browser storage for the character roster. Storage can be missing or blocked (private windows,
// cleared site data), so every access is guarded and the game keeps working without it.
import {
  parseRoster,
  serializeRoster,
  type LoadedRoster,
  type RosterEntry,
} from '../game/character/roster.ts';
import { data } from './builder/data.ts';

const KEY = 'wastes-crawler.roster';

export function loadRoster(): LoadedRoster {
  try {
    return parseRoster(localStorage.getItem(KEY), data);
  } catch {
    return {
      entries: [],
      errors: ['browser storage is unavailable, so the roster won’t be saved'],
    };
  }
}

/** Saves the roster; false when storage is unavailable. */
export function saveRoster(entries: readonly RosterEntry[]): boolean {
  try {
    localStorage.setItem(KEY, serializeRoster(entries));
    return true;
  } catch {
    return false;
  }
}

const WORLD_KEY = 'wastes-crawler.world';

/** The autosaved world, or null if there is none or storage is unavailable. */
export function loadWorldText(): string | null {
  try {
    return localStorage.getItem(WORLD_KEY);
  } catch {
    return null;
  }
}

export function saveWorldText(text: string | null): boolean {
  try {
    if (text === null) localStorage.removeItem(WORLD_KEY);
    else localStorage.setItem(WORLD_KEY, text);
    return true;
  } catch {
    return false;
  }
}
