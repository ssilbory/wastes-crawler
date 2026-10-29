import { describe, expect, it } from 'vitest';
import {
  nearestStairs,
  walkPath,
  walkStep,
  type WalkResult,
} from '../../../src/game/dungeon/walk.ts';
import type { World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter } from '../world/helpers.ts';
import { below, place, state } from './helpers.ts';

/** Every square of a level seen, as if the party had mapped it. */
function mapped(w: World, level: string, size: number): World {
  state(w).seen[level] = Array.from(
    { length: size * size },
    (_, i) => `${i % size},${(i / size) | 0}`,
  );
  return w;
}

/** Walks until the walk ends, returning each step's result. */
function walk(w: World, to: { x: number; y: number }): WalkResult[] {
  const out: WalkResult[] = [];
  for (let i = 0; i < 40; i++) {
    const r = walkStep(w, data, to);
    out.push(r);
    if (r.kind !== 'moved') break;
  }
  return out;
}

const at = (w: World) => `${state(w).at.x},${state(w).at.y}`;

describe('walkPath', () => {
  it('finds the shortest way through seen squares and doors', () => {
    const w = mapped(below(), 'barrow-upper', 10);
    expect(walkPath(w, data, { x: 1, y: 8 })).toEqual([]);
    expect(walkPath(w, data, { x: 4, y: 8 })).toEqual([
      { x: 2, y: 8 },
      { x: 3, y: 8 },
      { x: 4, y: 8 },
    ]);
  });

  it('has no way to an unseen square, a walled-off one, or through a known trap', () => {
    const w = below();
    expect(walkPath(w, data, { x: 9, y: 0 })).toBeNull();
    mapped(w, 'barrow-upper', 10);
    expect(walkPath(w, data, { x: 0, y: 4 })).toBeNull();
    expect(walkPath(w, data, { x: 4, y: 5 })).not.toBeNull();
    state(w).traps['barrow-upper'] = { '4,6': 'noticed' };
    expect(walkPath(w, data, { x: 4, y: 5 })).toBeNull();
    expect(walkPath(w, data, { x: 4, y: 6 })).toBeNull();
    // A disarmed trap is safe to cross.
    state(w).traps['barrow-upper'] = { '4,6': 'disarmed' };
    expect(walkPath(w, data, { x: 4, y: 5 })).not.toBeNull();
  });
});

describe('walkStep', () => {
  it('turns to face each step and walks to the square', () => {
    const w = mapped(below(), 'barrow-upper', 10);
    const steps = walk(w, { x: 7, y: 8 });
    expect(steps.at(-1)).toEqual({ kind: 'arrived' });
    expect(steps.slice(0, -1).every((r) => r.kind === 'moved')).toBe(true);
    expect(at(w)).toBe('7,8');
    expect(state(w).facing).toBe('e');
    expect(walkStep(w, data, { x: 7, y: 8 })).toEqual({ kind: 'arrived' });
  });

  it('walks west and south as well', () => {
    const w = mapped(below(), 'barrow-upper', 10);
    place(w, 'barrow-upper', 2, 8, 'e');
    expect(walk(w, { x: 0, y: 8 }).at(-1)).toEqual({ kind: 'arrived' });
    expect(state(w).facing).toBe('w');
    expect(walk(w, { x: 0, y: 9 }).at(-1)).toEqual({ kind: 'arrived' });
    expect(state(w).facing).toBe('s');
  });

  it('stops where there is no known way, or over an encounter', () => {
    const w = below();
    expect(walkStep(w, data, { x: 9, y: 0 })).toEqual({
      kind: 'stopped',
      reason: 'No known way leads there.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(walkStep(w, data, { x: 1, y: 7 })).toEqual({ kind: 'stopped', reason: null });
  });

  it('stops when a trap ahead is spotted', () => {
    const w = mapped(below(), 'barrow-upper', 10);
    place(w, 'barrow-upper', 4, 7, 'n');
    w.rng = scriptedRng([6, 6]);
    const r = walkStep(w, data, { x: 4, y: 5 });
    expect(r).toMatchObject({ kind: 'stopped' });
    expect((r as { reason: string }).reason).toMatch(/spots a dart trap ahead\.$/);
    expect(at(w)).toBe('4,7');
  });

  it('stops when the step makes the journal, as a message read', () => {
    const w = mapped(below(), 'barrow-lower', 8);
    place(w, 'barrow-lower', 1, 1, 'e');
    expect(walkStep(w, data, { x: 3, y: 1 })).toEqual({ kind: 'stopped', reason: null });
    expect(at(w)).toBe('2,1');
  });

  it('stops when something new comes into view', () => {
    const w = below();
    const seen = state(w).seen['barrow-upper'] as string[];
    const next = ['1,7', '2,8', '1,9'].find((k) => seen.includes(k)) as string;
    const [x, y] = next.split(',').map(Number) as [number, number];
    expect(walkStep(w, data, { x, y })).toEqual({
      kind: 'stopped',
      reason: 'Something new comes into view.',
    });
  });
});

describe('nearestStairs', () => {
  it('finds the nearest seen stairs the party can walk to, not the ones it stands on', () => {
    const w = below();
    expect(nearestStairs(w, data)).toBeNull();
    mapped(w, 'barrow-upper', 10);
    expect(nearestStairs(w, data)).toEqual({ x: 9, y: 0 });
    place(w, 'barrow-upper', 3, 8, 'n');
    expect(nearestStairs(w, data)).toEqual({ x: 1, y: 8 });
  });
});
