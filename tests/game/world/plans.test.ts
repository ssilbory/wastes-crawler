import { describe, expect, it } from 'vitest';
import { camp } from '../../../src/game/world/activities.ts';
import { route, setDestination, suggestPlan } from '../../../src/game/world/plans.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { data, member, world } from './helpers.ts';

/** Gives a member a build under way and, unless told not to, the crafting tools. */
function crafting(w: World, m: Member, withTools = true): void {
  w.projects.push({
    crafter: m.id,
    kind: 'gear',
    item: 'spear-light',
    quality: 'normal',
    daysLeft: 7,
    town: 'westhold',
    staying: false,
  });
  if (!withTools) return;
  const kit = { id: data.content.craftingRules.tools.id, quantity: 1, location: 'stowed' as const };
  m.character = { ...m.character, inventory: [...m.character.inventory, kit] };
}

describe('destinations', () => {
  it('accepts known reachable hexes, and clears on arrival or null', () => {
    const w = world();
    expect(setDestination(w, data, { col: 4, row: 8 })).toBe(true);
    expect(route(w, data)).toEqual([{ col: 4, row: 8 }]);
    expect(setDestination(w, data, { col: 3, row: 8 })).toBe(true);
    expect(w.destination).toBeNull();
    expect(route(w, data)).toEqual([]);
    expect(setDestination(w, data, null)).toBe(false);
  });

  it('heads toward an unexplored hex, routing to the edge of the known map', () => {
    const w = world();
    expect(setDestination(w, data, { col: 20, row: 8 })).toBe(true);
    expect(w.destination).toEqual({ col: 20, row: 8 });
    expect(route(w, data)).toEqual([{ col: 4, row: 8 }]);
    // South of the lake, every known hex nearer the hills beyond it is water.
    Object.assign(w, { position: { col: 6, row: 7 }, visited: new Set(['6,7']) });
    expect(setDestination(w, data, { col: 6, row: 3 })).toBe(false);
    expect(w.destination).toEqual({ col: 20, row: 8 });
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
      activities: { 'm-0': 'make-camp', 'm-1': 'firewood', 'm-2': 'watch', 'm-3': 'sleep' },
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

  it('sends those with Survival who have slept for food at night instead of resting', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    w.camp = 'made';
    w.quarter = 3;
    for (const name of ['Snag', 'Grukk', 'Fizzwick']) member(w, name).slept = true;
    // Snag has Survive; Grukk and Fizzwick don't, so one watches and the other rests.
    expect(suggestPlan(w, data)).toEqual({
      kind: 'camp',
      activities: { 'm-0': 'forage', 'm-1': 'rest', 'm-2': 'sleep', 'm-3': 'watch' },
    });
    const grukk = member(w, 'Grukk');
    grukk.character = { ...grukk.character, skills: { ...grukk.character.skills, survive: 0 } };
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-0': 'forage', 'm-1': 'hunt' } });
    // Unslept, Snag sleeps and Grukk forages in his place.
    member(w, 'Snag').slept = false;
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-0': 'sleep', 'm-1': 'forage' } });
    // In the evening no one has slept yet, so nobody goes for food then.
    for (const m of w.members) m.slept = false;
    w.quarter = 2;
    const evening = suggestPlan(w, data);
    expect(evening.kind === 'camp' && Object.values(evening.activities)).not.toContain('forage');
  });

  it('has a crafter with tools craft the day’s camp shifts instead of foraging or hunting', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    crafting(w, member(w, 'Snag'), false);
    // Without tools, Snag forages as before.
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-0': 'forage' } });
    w.projects = [];
    crafting(w, member(w, 'Snag'));
    expect(suggestPlan(w, data)).toEqual({
      kind: 'camp',
      activities: { 'm-0': 'craft', 'm-1': 'forage', 'm-2': 'hunt', 'm-3': 'rest' },
    });
    // In town the work waits for the workshop.
    w.position = { col: 3, row: 8 };
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-0': 'rest' } });
  });

  it('spares a crafter the watch while anyone else can keep it', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    w.camp = 'made';
    w.quarter = 2;
    crafting(w, member(w, 'Lirael'));
    expect(suggestPlan(w, data)).toEqual({
      kind: 'camp',
      activities: { 'm-0': 'sleep', 'm-1': 'sleep', 'm-2': 'sleep', 'm-3': 'watch' },
    });
    member(w, 'Lirael').slept = true;
    member(w, 'Grukk').slept = true;
    w.quarter = 3;
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-1': 'watch', 'm-2': 'rest' } });
    // A lone crafter still keeps watch.
    member(w, 'Grukk').slept = false;
    expect(suggestPlan(w, data)).toMatchObject({ activities: { 'm-2': 'watch' } });
  });

  it('takes half a day off the build for each camp quarter spent crafting', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    crafting(w, member(w, 'Fizzwick'));
    camp(w, data, { 'm-3': 'craft' });
    expect(w.projects[0]?.daysLeft).toBe(6.5);
    expect(w.log.at(-1)).toContain('Fizzwick works on the Spear, Light.');
  });
});
