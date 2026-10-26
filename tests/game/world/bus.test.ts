import { describe, expect, it } from 'vitest';
import type { GameData } from '../../../src/game/character/context.ts';
import { emit, type Listener, type WorldEvent } from '../../../src/game/world/bus.ts';
import { WORLD_LISTENERS } from '../../../src/game/world/listeners.ts';
import { realmEndListener } from '../../../src/game/world/realm-end.ts';
import { data, world } from './helpers.ts';

const DAY: WorldEvent = { kind: 'day-passed' };

/** Game data whose listeners record, in order, which of them heard each event. */
function recording(campaign: readonly string[]): { d: GameData; heard: string[] } {
  const heard: string[] = [];
  const names = ['first', 'story', 'last'];
  const all = names.map(
    (name): Listener =>
      () =>
        heard.push(name),
  );
  const story = new Set(all.filter((_, i) => campaign.includes(names[i] as string)));
  return { d: { ...data, listeners: { all, campaign: story } }, heard };
}

describe('emit', () => {
  it('reaches every listener, in order, in the campaign', () => {
    const { d, heard } = recording(['story']);
    emit(world(), d, DAY);
    expect(heard).toEqual(['first', 'story', 'last']);
  });

  it('skips the campaign-only listeners in a realm or on a custom map', () => {
    const { d, heard } = recording(['story']);
    const w = world();
    w.realm = 'sealed-vale';
    emit(w, d, DAY);
    expect(heard).toEqual(['first', 'last']);
  });

  it('throws rather than dropping events when the game data has no listeners', () => {
    const bare = { srd: data.srd, content: data.content } as GameData;
    expect(() => emit(world(), bare, DAY)).toThrow(/no world listeners/);
  });
});

describe('WORLD_LISTENERS', () => {
  it('ends with the realm ending, and its campaign-only listeners are among them', () => {
    expect(WORLD_LISTENERS.all.at(-1)).toBe(realmEndListener);
    expect(WORLD_LISTENERS.campaign.size).toBe(4);
    for (const l of WORLD_LISTENERS.campaign) expect(WORLD_LISTENERS.all).toContain(l);
  });

  it('is what the shared test data carries', () => {
    expect(data.listeners).toBe(WORLD_LISTENERS);
  });
});
