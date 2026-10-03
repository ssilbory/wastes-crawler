import { describe, expect, it } from 'vitest';
import { camp, hike, mishap } from '../../../src/game/world/activities.ts';
import type { World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, withMishap, world } from './helpers.ts';

const at = (w: World, col: number, row: number) => {
  w.position = { col, row };
  w.camp = 'none';
  return w;
};

describe('mishaps (our tables)', () => {
  it('applies each kind of effect', () => {
    const w = at(world([1]), 5, 9);
    expect(mishap(w, withMishap({ kind: 'end-march' }), 'travel')).toEqual({
      endMarch: true,
      extraChecks: 0,
    });
    expect(w.log.at(-1)).toContain('A travel mishap.');
    w.rng = scriptedRng([1, 0, 3]);
    const dice = { count: 1, sides: 4, modifier: 0 };
    mishap(w, withMishap({ kind: 'damage', dice, who: 'one' }), 'camp');
    expect(member(w, 'Snag').character.hp.current).toBe(5);
    w.rng = scriptedRng([1]);
    mishap(w, withMishap({ kind: 'strain', amount: 1, who: 'all' }), 'camp');
    expect(w.members.every((m) => m.character.strain.value === 1)).toBe(true);
    w.rng = scriptedRng([1]);
    mishap(w, withMishap({ kind: 'rations', steps: -2 }), 'camp');
    expect(w.rations).toBe(8);
    w.rng = scriptedRng([1]);
    mishap(w, withMishap({ kind: 'no-recovery' }), 'camp');
    expect(w.noRecovery).toBe(true);
    w.rng = scriptedRng([1]);
    expect(mishap(w, withMishap({ kind: 'encounter' }), 'camp').extraChecks).toBe(1);
    // Weighted picks reach later entries.
    w.rng = scriptedRng([8, 0, 2]);
    mishap(w, data, 'camp');
    expect(w.log.at(-2)).toContain('A collapsing fire burns someone.');
  });
});

describe('hiking', () => {
  it('walks toward the destination, checking Lead the Way in new hexes off the road', () => {
    const w = at(world([]), 3, 8);
    w.visited.add('4,8');
    w.destination = { col: 5, row: 8 };
    expect(hike(w, data, 'm-2', false)).toBe(0);
    expect(w).toMatchObject({ position: { col: 5, row: 8 }, destination: null, hikes: 1 });
    expect(w.visited.has('5,8')).toBe(true);
    w.rng = scriptedRng([6, 6]);
    w.destination = { col: 5, row: 9 };
    hike(w, data, 'm-2', false);
    expect(w.position).toEqual({ col: 5, row: 9 });
  });

  it('suffers a mishap without a leader, at a disadvantage in the dark', () => {
    const w = at(world([1]), 3, 8);
    w.destination = { col: 4, row: 9 };
    hike(w, withMishap({ kind: 'end-march' }), null, false);
    expect(w.log.at(-1)).toContain('A travel mishap.');
    at(w, 3, 8);
    w.visited.delete('4,9');
    w.rng = scriptedRng([1, 1, 6, 1]);
    w.destination = { col: 4, row: 9 };
    expect(hike(w, withMishap({ kind: 'encounter' }), 'm-2', true)).toBe(1);
  });

  it('stops where the next hex costs more than the points left, and enters towns', () => {
    const w = at(world(), 1, 5);
    w.visited.add('1,4');
    w.destination = { col: 1, row: 3 };
    hike(w, data, 'm-2', false);
    expect(w.position).toEqual({ col: 1, row: 4 });
    at(w, 5, 8);
    w.visited.add('4,8');
    w.destination = { col: 3, row: 8 };
    w.rations = 4;
    hike(w, data, 'm-2', false);
    expect(w).toMatchObject({ position: { col: 3, row: 8 }, rations: 4, lastTown: 'westhold' });
    expect(w.log.at(-1)).toContain('The party reaches Westhold.');
  });

  it('needs Exert checks past two quarters, and has nowhere to go without a route', () => {
    const w = at(world([6, 6, 6, 6, 1, 1, 6, 6]), 3, 8);
    w.destination = { col: 4, row: 8 };
    w.hikes = 2;
    hike(w, data, 'm-2', false);
    expect(w.log.at(-1)).toContain("Lirael can't go on; the march ends.");
    expect(w).toMatchObject({ hikes: 3, position: { col: 3, row: 8 } });
    w.rng = scriptedRng([6, 6, 6, 6, 6, 6, 6, 6, 6, 6]);
    hike(w, data, 'm-2', false);
    expect(w.position).toEqual({ col: 4, row: 8 });
    w.destination = null;
    expect(hike(w, data, 'm-2', false)).toBe(0);
    expect(w.log.at(-1)).toContain('nowhere it can hike to');
  });

  it('makes the Overloaded save on each hex, at 1 strain a failure', () => {
    const w = at(world([1, 6, 6]), 3, 8);
    const snag = member(w, 'Snag');
    snag.character = {
      ...snag.character,
      inventory: [
        ...snag.character.inventory,
        { id: 'firewood-one-nights-fire', quantity: 3, location: 'stowed' },
      ],
    };
    w.visited.add('4,8');
    w.destination = { col: 4, row: 8 };
    hike(w, data, 'm-2', false);
    expect(snag.character.strain.value).toBe(1);
    expect(w.log).toContainEqual(expect.stringContaining('Snag staggers under the load.'));
    snag.character = { ...snag.character, strain: { value: 0, broken: true } };
    w.rng = scriptedRng([20, 6, 1]);
    w.destination = { col: 5, row: 8 };
    w.visited.add('5,8');
    hike(w, data, 'm-2', false);
    expect(snag.character.strain.value).toBe(0);
  });
});

describe('camp quarters', () => {
  const all = (a: string) => ({ 'm-0': a, 'm-1': a, 'm-2': a, 'm-3': a }) as never;

  it('rests and sleeps, and returns the watcher', () => {
    const w = at(world([]), 5, 9);
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, strain: { value: 2, broken: false } };
    const result = camp(w, data, { 'm-0': 'sleep', 'm-1': 'watch', 'm-2': 'rest', 'm-3': 'rest' });
    expect(result).toEqual({ extraChecks: 0, watcher: member(w, 'Grukk') });
    expect(snag).toMatchObject({ slept: true, character: { strain: { value: 1 } } });
  });

  it('makes camp on a good Survive check, or rolls a camp mishap', () => {
    const w = at(world([6, 6]), 5, 9);
    camp(w, data, { 'm-2': 'make-camp' });
    expect(w.camp).toBe('made');
    camp(w, data, { 'm-2': 'make-camp' });
    w.camp = 'none';
    w.rng = scriptedRng([1, 1, 1]);
    expect(camp(w, withMishap({ kind: 'encounter' }), { 'm-2': 'make-camp' }).extraChecks).toBe(1);
    expect(w.camp).toBe('failed');
    at(w, 3, 8);
    camp(w, data, { 'm-2': 'make-camp' });
    expect(w.camp).toBe('made');
  });

  it('forages and hunts into the rations die, each risking an encounter', () => {
    const w = at(world([6, 6, 6, 6]), 5, 9);
    w.rations = 4;
    expect(camp(w, data, { 'm-0': 'forage', 'm-1': 'hunt' }).extraChecks).toBe(2);
    expect(w.rations).toBe(10);
    w.rng = scriptedRng([1, 1]);
    camp(w, data, all('forage'));
    expect(w.log.at(-1)).toContain('finds nothing');
    expect(camp(at(w, 3, 8), data, all('hunt')).extraChecks).toBe(0);
  });

  it('fishes where there is water and no game, and can’t hunt where there is neither', () => {
    const noGame = {
      ...data,
      content: {
        ...data.content,
        terrains: data.content.terrains.map((t) =>
          t.id === 'ford' || t.id === 'plains' ? { ...t, hunt: null } : t,
        ),
      },
    };
    const w = at(world([6, 6]), 12, 8);
    w.rations = 4;
    camp(w, noGame, { 'm-0': 'hunt' });
    expect(w.rations).toBe(8);
    expect(camp(at(w, 5, 9), noGame, { 'm-0': 'hunt' }).extraChecks).toBe(0);
  });
});
