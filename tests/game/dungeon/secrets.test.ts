import { describe, expect, it } from 'vitest';
import { step } from '../../../src/game/dungeon/explore.ts';
import { edgeKey, glimpse, knownEdges, search } from '../../../src/game/dungeon/secrets.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, world } from '../world/helpers.ts';
import { below, place, state } from './helpers.ts';

const noSecretLists = {
  ...data,
  content: {
    ...data.content,
    dungeons: data.content.dungeons.map((d) => ({
      ...d,
      levels: d.levels.map((l) => ({ ...l, secrets: [] })),
    })),
  },
};

describe('secret doors (docs/rules-adaptation.md, Dungeon exploration)', () => {
  it('keys each edge once, from the cell to its south or east', () => {
    expect(edgeKey({ x: 1, y: 1 }, 's')).toBe('1,2,n');
    expect(edgeKey({ x: 1, y: 1 }, 'e')).toBe('2,1,w');
    expect(edgeKey({ x: 1, y: 1 }, 'n')).toBe('1,1,n');
    expect(edgeKey({ x: 1, y: 1 }, 'w')).toBe('1,1,w');
  });

  it('finds a secret door with a turn of searching nearby, after which it is a door', () => {
    const w = place(below(), 'barrow-upper', 2, 1, 'e');
    expect(knownEdges(w, data)({ x: 3, y: 1 }, 'e')).toBe('secret');
    const rng = scriptedRng([6, 6, 3]);
    w.rng = rng;
    expect(search(w, data)).toEqual({ ok: true });
    expect(rng.remaining()).toBe(0);
    expect(w.log.at(-1)).toMatch(/finds a secret door\.$/);
    expect(state(w).found['barrow-upper']).toEqual(['4,1,w']);
    expect(state(w).turn).toBe(1);
    expect(knownEdges(w, data)({ x: 4, y: 1 }, 'w')).toBe('door');
    place(w, 'barrow-upper', 3, 1, 'e');
    expect(step(w, data, 'forward')).toEqual({ ok: true });
    expect(state(w).at).toEqual({ x: 4, y: 1 });
  });

  it('turns up nothing on a failed or empty search', () => {
    const w = place(below(), 'barrow-upper', 2, 1, 'e');
    w.rng = scriptedRng([1, 1, 3]);
    search(w, noSecretLists);
    expect(w.log.at(-1)).toContain('The search turns up nothing.');
    place(w, 'barrow-upper', 1, 8, 'n');
    w.rng = scriptedRng([3]);
    search(w, data);
    expect(w.log.at(-1)).toContain('The search turns up nothing.');
  });

  it('can’t search in the dark, mid-encounter, or on the surface', () => {
    const w = below();
    w.light.lit = null;
    expect(search(w, data)).toEqual({ ok: false, reason: 'It is too dark to search.' });
    w.encounter = encounter([['thug-or-militia']]);
    expect(search(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    expect(() => search(world(), data)).toThrow('the party is not in a dungeon');
  });

  it('gets one free look, at +2 difficulty, on stepping next to a secret door', () => {
    const w = place(below(), 'barrow-upper', 2, 1, 'e');
    w.rng = scriptedRng([1, 1]);
    step(w, data, 'forward');
    expect(state(w).glimpsed['barrow-upper']).toEqual(['4,1,w']);
    expect(state(w).found['barrow-upper']).toBeUndefined();
    w.rng = scriptedRng([]);
    step(w, data, 'back');
    step(w, data, 'forward');
    expect(state(w).found['barrow-upper']).toBeUndefined();
    // Another visit, no new door: no roll. A lucky look finds it.
    const lucky = place(below(), 'barrow-upper', 2, 1, 'e');
    lucky.rng = scriptedRng([6, 6]);
    step(lucky, data, 'forward');
    expect(state(lucky).found['barrow-upper']).toEqual(['4,1,w']);
  });

  it('gets no free look in the dark', () => {
    const w = place(below(), 'barrow-upper', 3, 1, 'e');
    w.light.lit = null;
    glimpse(w, data);
    expect(state(w).glimpsed['barrow-upper']).toBeUndefined();
  });
});
