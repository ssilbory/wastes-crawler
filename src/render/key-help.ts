// The keys each screen answers to, for the list `?` shows (Sam's ask). Pure.
import type { KeyAction, Settings } from '../data/schemas/index.ts';
import { ACTION_NAMES, keyLabel } from './settings-view.ts';

export interface KeyRow {
  keys: string;
  does: string;
}

const HELP: KeyRow = { keys: '?', does: 'Show these keys' };

/** The hex map's keys (MapScreen.tsx and map-keys.ts). */
export const MAP_KEYS: readonly KeyRow[] = [
  { keys: 'G', does: 'Travel on toward the targeted hex' },
  { keys: 'H', does: 'Plan a hike' },
  { keys: 'C', does: 'Plan a camp' },
  { keys: 'Q', does: 'Play out the quarter as planned' },
  { keys: 'T', does: 'Visit the town here' },
  {
    keys: 'Space',
    does: 'Play out the quarter toward the targeted hex; with none, visit the town or go down the way here',
  },
  { keys: 'Arrow keys', does: 'Move between hexes on the map, once it has focus' },
  { keys: 'Enter', does: 'Target the hex in focus' },
  HELP,
];

/** The dungeon's keys, as the settings bind them (DungeonScreen.tsx). */
export function dungeonKeys(settings: Pick<Settings, 'keys'>): KeyRow[] {
  const bound = (Object.keys(ACTION_NAMES) as KeyAction[]).map((a) => ({
    keys: settings.keys[a].map(keyLabel).join(' or ') || 'Not set',
    does: ACTION_NAMES[a],
  }));
  return [
    ...bound,
    { keys: 'Click the map', does: 'Walk to a square already seen; any key stops the walk' },
    HELP,
  ];
}

/** A fight's command keys (CommandMenu.tsx). */
export const FIGHT_KEYS: readonly KeyRow[] = [
  { keys: '1 to 9', does: 'Pick a command, then its target' },
  { keys: 'Backspace', does: 'Back out of a command' },
  { keys: 'D', does: 'Take the default action' },
  HELP,
];
