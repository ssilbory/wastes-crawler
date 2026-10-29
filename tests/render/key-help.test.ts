import { describe, expect, it } from 'vitest';
import { defaultSettings } from '../../src/game/settings.ts';
import { dungeonKeys, FIGHT_KEYS, MAP_KEYS } from '../../src/render/key-help.ts';
import { keyLabel } from '../../src/render/settings-view.ts';
import { data } from '../game/world/helpers.ts';

describe('key help', () => {
  it('lists the map and fight keys, each ending with how to show them', () => {
    expect(MAP_KEYS.map((r) => r.keys)).toEqual([
      'G',
      'H',
      'C',
      'Q',
      'T',
      'Space',
      'Arrow keys',
      'Enter',
      '?',
    ]);
    expect(FIGHT_KEYS.at(-1)).toEqual({ keys: '?', does: 'Show these keys' });
  });

  it('lists the dungeon keys as the settings bind them', () => {
    const settings = defaultSettings(data);
    const rows = dungeonKeys(settings);
    expect(rows[0]).toEqual({
      keys: settings.keys.forward.map(keyLabel).join(' or '),
      does: 'Forward',
    });
    const unbound = dungeonKeys({ keys: { ...settings.keys, search: [] } });
    expect(unbound.find((r) => r.does === 'Search')?.keys).toBe('Not set');
    expect(rows.at(-2)?.keys).toBe('Click the map');
    expect(rows.at(-1)?.keys).toBe('?');
  });
});
