// The player's settings (docs/plan.md, Phase 11: settings, key remapping, optional sound): read from
// the browser, falling back to the defaults in data/content/settings-defaults.json, and changed one
// value at a time. A key is bound to at most one action.
import { SettingsSchema, type KeyAction, type Settings } from '../data/schemas/index.ts';
import type { GameData } from './character/context.ts';

export const defaultSettings = (data: GameData): Settings =>
  structuredClone(data.content.settingsDefaults.settings);

/**
 * Key actions added since the settings were stored take their default keys, less any the stored
 * settings already bind elsewhere.
 */
function withNewActions(raw: unknown, data: GameData): unknown {
  const keys = (raw as { keys?: unknown } | null)?.keys;
  if (typeof keys !== 'object' || keys === null) return raw;
  const stored = keys as Record<string, unknown>;
  const taken = new Set(Object.values(stored).flat());
  const added = Object.entries(defaultSettings(data).keys)
    .filter(([action]) => !(action in stored))
    .map(([action, list]) => [action, list.filter((k) => !taken.has(k))]);
  return { ...(raw as object), keys: { ...stored, ...Object.fromEntries(added) } };
}

/**
 * Keys that never take an action: Tab and Enter move focus and press buttons, Escape cancels, and
 * a modifier alone is half a chord.
 */
const RESERVED = new Set(['Tab', 'Enter', 'Escape', 'Shift', 'Control', 'Alt', 'Meta', 'AltGraph']);

/** Whether a key can be bound to an action. */
export const bindable = (key: string): boolean => !RESERVED.has(key);

/** Stored settings, or the defaults if there are none or they no longer fit the schema. */
export function parseSettings(text: string | null, data: GameData): Settings {
  if (text === null) return defaultSettings(data);
  try {
    const parsed = SettingsSchema.safeParse(withNewActions(JSON.parse(text), data));
    if (!parsed.success) return defaultSettings(data);
    // A reserved key stored by an older version is dropped.
    const keys = Object.fromEntries(
      Object.entries(parsed.data.keys).map(([a, list]) => [a, list.filter(bindable)]),
    ) as Settings['keys'];
    return { ...parsed.data, keys };
  } catch {
    return defaultSettings(data);
  }
}

export const serializeSettings = (s: Settings) => JSON.stringify(s);

/** Letters match whatever the case; other keys by name. */
export const normalKey = (key: string) => (key.length === 1 ? key.toLowerCase() : key);

export function actionForKey(s: Settings, key: string): KeyAction | null {
  const k = normalKey(key);
  const hit = Object.entries(s.keys).find(([, keys]) => keys.includes(k));
  return hit ? (hit[0] as KeyAction) : null;
}

/**
 * Binds a key to an action's first or second slot, taking it from any action that had it. A
 * reserved key changes nothing.
 */
export function rebind(s: Settings, action: KeyAction, slot: 0 | 1, key: string): Settings {
  if (!bindable(key)) return s;
  const k = normalKey(key);
  const keys = Object.fromEntries(
    Object.entries(s.keys).map(([a, list]) => [a, list.filter((x) => x !== k)]),
  ) as Settings['keys'];
  const mine = [...keys[action]];
  if (slot < mine.length) mine[slot] = k;
  else mine.push(k);
  return { ...s, keys: { ...keys, [action]: mine } };
}

export function unbind(s: Settings, action: KeyAction, slot: 0 | 1): Settings {
  return { ...s, keys: { ...s.keys, [action]: s.keys[action].filter((_, i) => i !== slot) } };
}

/** Milliseconds between rounds when auto-resolving. */
export const roundDelay = (data: GameData, s: Settings) =>
  data.content.settingsDefaults.roundDelays[s.combatSpeed];

export function soundCue(data: GameData, id: string) {
  const cue = data.content.soundCues.find((c) => c.id === id);
  if (!cue) throw new Error(`unknown sound cue ${id}`);
  return cue;
}
