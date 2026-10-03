import { describe, expect, it } from 'vitest';
import { route, setDestination, suggestPlan } from '../../../src/game/world/plans.ts';
import { data, member, world } from './helpers.ts';

describe('destinations', () => {
  it('accepts known reachable hexes, and clears on arrival or null', () => {
    const w = world();
    expect(setDestination(w, data, { col: 4, row: 8 })).toBe(true);
    expect(route(w, data)).toEqual([{ col: 4, row: 8 }]);
    expect(setDestination(w, data, { col: 20, row: 8 })).toBe(false);
    expect(w.destination).toEqual({ col: 4, row: 8 });
    expect(setDestination(w, data, { col: 3, row: 8 })).toBe(true);
    expect(w.destination).toBeNull();
    expect(route(w, data)).toEqual([]);
    expect(setDestination(w, data, null)).toBe(false);
    w.destination = { col: 20, row: 8 };
    expect(route(w, data)).toEqual([]);
  });
});

describe('suggested plans', () => {
  it('hikes by day with the best guide and lookout', () => {
    const w = world();
    w.destination = { col: 4, row: 8 };
    expect(suggestPlan(w, data)).toEqual({ kind: 'hike', leader: 'm-0', watcher: 'm-2' });
    expect(suggestPlan(w, data, 'camp').kind).toBe('camp');
    w.quarter = 2;
    expect(suggestPlan(w, data).kind).toBe('camp');
    expect(suggestPlan(w, data, 'hike').kind).toBe('hike');
    w.quarter = 0;
    const lone = world();
    lone.members = [member(lone, 'Snag')];
    lone.destination = { col: 4, row: 8 };
    expect(suggestPlan(lone, data)).toEqual({ kind: 'hike', leader: 'm-0', watcher: 'm-0' });
    // Alone in the evening, the one member keeps watch instead of sleeping.
    Object.assign(lone, { destination: null, position: { col: 5, row: 9 }, quarter: 2 });
    expect(suggestPlan(lone, data)).toEqual({ kind: 'camp', activities: { 'm-0': 'watch' } });
    lone.members = [];
    lone.destination = { col: 4, row: 8 };
    lone.quarter = 0;
    expect(suggestPlan(lone, data)).toEqual({ kind: 'hike', leader: null, watcher: null });
  });

  it('rests in town, sleeping from the evening on', () => {
    const w = world();
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-0': 'rest', 'm-3': 'rest' } });
    w.quarter = 2;
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-0': 'sleep' } });
  });

  it('forages and hunts by day without a destination', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    expect(suggestPlan(w, data)).toEqual({
      kind: 'camp',
      activities: { 'm-0': 'forage', 'm-1': 'hunt', 'm-2': 'rest', 'm-3': 'rest' },
    });
  });

  it('makes camp and keeps watch in the evening, and swaps sleepers at night', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    w.camp = 'none';
    w.quarter = 2;
    const evening = suggestPlan(w, data);
    expect(evening).toEqual({
      kind: 'camp',
      activities: { 'm-0': 'make-camp', 'm-1': 'sleep', 'm-2': 'watch', 'm-3': 'sleep' },
    });
    w.camp = 'made';
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-0': 'sleep' } });
    member(w, 'Grukk').slept = true;
    member(w, 'Fizzwick').slept = true;
    w.quarter = 3;
    expect(suggestPlan(w, data)).toEqual({
      kind: 'camp',
      activities: { 'm-0': 'sleep', 'm-1': 'rest', 'm-2': 'sleep', 'm-3': 'watch' },
    });
  });
});
