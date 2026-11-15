import { describe, expect, it } from 'vitest';
import type { LockState } from '../../../src/data/schemas/index.ts';
import {
  armed,
  cannotWork,
  lookOver,
  newLock,
  trapDifficulty,
} from '../../../src/game/world/lockwork.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, encounter, world } from './helpers.ts';

const lock = (of: Partial<LockState> = {}): LockState => ({
  difficulty: 7,
  trap: null,
  trapState: 'hidden',
  looked: false,
  heavy: false,
  ...of,
});

describe('lockwork (Locks and chests)', () => {
  it('draws a trap only for a trapped lock', () => {
    const w = world();
    w.rng = scriptedThen([2], createRng('lock'));
    expect(newLock(w, data, 9, true, true)).toEqual({
      difficulty: 9,
      trap: data.content.chests.traps[2],
      trapState: 'hidden',
      looked: false,
      heavy: true,
    });
    expect(newLock(w, data, 9, false).trap).toBeNull();
  });

  it('makes a heavy trap harder to find and work', () => {
    expect(trapDifficulty(data, lock())).toBe(7);
    expect(trapDifficulty(data, lock({ heavy: true }))).toBe(9);
  });

  it('counts a trap set only while hidden or spotted', () => {
    const trap = data.content.chests.traps[0] as LockState['trap'];
    expect(armed(lock())).toBe(false);
    expect(armed(lock({ trap }))).toBe(true);
    expect(armed(lock({ trap, trapState: 'noticed' }))).toBe(true);
    expect(armed(lock({ trap, trapState: 'disarmed' }))).toBe(false);
    expect(armed(lock({ trap, trapState: 'sprung' }))).toBe(false);
  });

  it('looks once, rolling only for a trap or something stirring', () => {
    const w = world();
    w.rng = scriptedThen([], createRng('none'));
    const plain = lock();
    lookOver(w, data, plain, 'chest');
    expect(plain).toMatchObject({ looked: true, trapState: 'hidden' });
    const stirs = lock();
    w.rng = scriptedThen([6, 6], createRng('stir'));
    lookOver(w, data, stirs, 'chest', true);
    expect(stirs.trapState).toBe('noticed');
    // A second look does nothing.
    stirs.trapState = 'hidden';
    lookOver(w, data, stirs, 'chest', true);
    expect(stirs.trapState).toBe('hidden');
  });

  it('refuses work during an encounter or with no one fit', () => {
    const w = world();
    expect(cannotWork(w, data)).toBeNull();
    w.encounter = encounter([['thug-or-militia']]);
    expect(cannotWork(w, data)).toBe('Settle the encounter first.');
    w.encounter = null;
    for (const m of w.members) m.character.hp = { ...m.character.hp, current: 0 };
    expect(cannotWork(w, data)).toBe('No one is fit to work.');
  });
});
