import { describe, expect, it } from 'vitest';
import {
  actionForKey,
  defaultSettings,
  normalKey,
  parseSettings,
  rebind,
  roundDelay,
  serializeSettings,
  soundCue,
  unbind,
} from '../../src/game/settings.ts';
import { ACTION_NAMES, keyLabel } from '../../src/render/settings-view.ts';
import { data } from './world/helpers.ts';

describe('settings (docs/plan.md, Phase 11)', () => {
  it('start from the defaults: sound off, instant combat, normal text', () => {
    const s = defaultSettings(data);
    expect(s).toMatchObject({ sound: { on: false }, combatSpeed: 'instant', textSize: 'normal' });
    expect(parseSettings(null, data)).toEqual(s);
    expect(parseSettings('{', data)).toEqual(s);
    expect(parseSettings('{"version":2}', data)).toEqual(s);
    const quiet = { ...s, sound: { on: true, volume: 0.2 } };
    expect(parseSettings(serializeSettings(quiet), data)).toEqual(quiet);
    // The defaults themselves are never changed.
    s.keys.forward.push('x');
    expect(defaultSettings(data).keys.forward).toEqual(['w', 'ArrowUp']);
  });

  it('find the action for a key, letters in either case', () => {
    const s = defaultSettings(data);
    expect(actionForKey(s, 'W')).toBe('forward');
    expect(actionForKey(s, 'ArrowLeft')).toBe('turn-left');
    expect(actionForKey(s, 'f')).toBe('search');
    expect(actionForKey(s, 'z')).toBeNull();
    expect(normalKey('Q')).toBe('q');
  });

  it('rebind a key, taking it from any other action', () => {
    const s = defaultSettings(data);
    const t = rebind(s, 'search', 0, 'W');
    expect(t.keys.search).toEqual(['w']);
    expect(t.keys.forward).toEqual(['ArrowUp']);
    const u = rebind(t, 'step-left', 1, 'z');
    expect(u.keys['step-left']).toEqual(['q', 'z']);
    expect(unbind(u, 'step-left', 0).keys['step-left']).toEqual(['z']);
    expect(s.keys.forward).toEqual(['w', 'ArrowUp']);
  });

  it('give each combat speed its delay, and each cue its notes', () => {
    const s = defaultSettings(data);
    expect(roundDelay(data, s)).toBe(0);
    expect(roundDelay(data, { ...s, combatSpeed: 'slow' })).toBe(1200);
    expect(soundCue(data, 'step').notes).toHaveLength(1);
    expect(() => soundCue(data, 'kazoo')).toThrow('unknown sound cue kazoo');
  });

  it('label keys and actions', () => {
    expect(keyLabel('ArrowUp')).toBe('↑');
    expect(keyLabel(' ')).toBe('Space');
    expect(keyLabel('q')).toBe('Q');
    expect(keyLabel('Enter')).toBe('Enter');
    expect(ACTION_NAMES['step-left']).toBe('Step left');
  });
});
