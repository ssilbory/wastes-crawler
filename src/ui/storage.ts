// Browser storage for the character roster. Storage can be missing or blocked (private windows,
// cleared site data), so every access is guarded and the game keeps working without it.
import {
  parseRoster,
  rosterToSave,
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

/**
 * Saves the roster, keeping stored characters that no longer load, and a roster that can't be read
 * at all aside under its own key; false when storage is unavailable.
 */
export function saveRoster(entries: readonly RosterEntry[]): boolean {
  try {
    const { text, backup } = rosterToSave(localStorage.getItem(KEY), entries, data);
    if (backup !== null) localStorage.setItem(`${KEY}.unreadable`, backup);
    localStorage.setItem(KEY, text);
    return true;
  } catch {
    return false;
  }
}

/** Save slots (Sam's call: three). Slot 1 keeps the key the single save always used. */
export const SLOTS = [1, 2, 3] as const;
export type Slot = (typeof SLOTS)[number];
const slotKey = (slot: Slot) =>
  slot === 1 ? 'wastes-crawler.world' : `wastes-crawler.world.${slot}`;
const ACTIVE_KEY = 'wastes-crawler.slot';

/** The slot the game autosaves into. */
export function activeSlot(): Slot {
  try {
    const n = Number(localStorage.getItem(ACTIVE_KEY));
    return SLOTS.find((s) => s === n) ?? 1;
  } catch {
    return 1;
  }
}

export function setActiveSlot(slot: Slot): void {
  try {
    localStorage.setItem(ACTIVE_KEY, String(slot));
  } catch {
    // Without storage the game plays on in slot 1, unsaved.
  }
}

/** A slot's saved world, or null if there is none or storage is unavailable. */
export function loadWorldText(slot: Slot = activeSlot()): string | null {
  try {
    return localStorage.getItem(slotKey(slot));
  } catch {
    return null;
  }
}

export function saveWorldText(text: string | null, slot: Slot = activeSlot()): boolean {
  try {
    if (text === null) localStorage.removeItem(slotKey(slot));
    else localStorage.setItem(slotKey(slot), text);
    return true;
  } catch {
    return false;
  }
}
