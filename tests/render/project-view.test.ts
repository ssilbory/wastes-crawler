import { describe, expect, it } from 'vitest';
import { startFactions } from '../../src/game/factions/state.ts';
import { enterRegion } from '../../src/game/world/enter-region.ts';
import { newWorld } from '../../src/game/world/new-world.ts';
import type { World } from '../../src/game/world/types.ts';
import { progressOf } from '../../src/game/world/major-projects.ts';
import { projectsView } from '../../src/render/project-view.ts';
import { createRng } from '../../src/rules/rng.ts';
import { data, starter, world } from '../game/world/helpers.ts';

function inCinderhold(): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 6, row: 12 });
  w.position = { col: 6, row: 12 };
  startFactions(w, data);
  return w;
}

describe('projects view (docs/rules-adaptation.md, Major projects)', () => {
  it('lists the projects on the party’s map, with what stands against each', () => {
    const w = inCinderhold();
    w.renown = 3;
    const v = projectsView(w, data);
    expect(v.renown).toBe(3);
    expect(v.projects.map((p) => p.id)).toEqual([
      'wall-lanternfall',
      'wall-mirewatch',
      'wall-gutterwick',
      'secure-ash-road',
      'end-grisks-tithe',
      'cinderhold-cisterns',
      'mirewatch-drains',
    ]);
    const road = v.projects.find((p) => p.id === 'secure-ash-road');
    expect(road).toMatchObject({
      name: 'Secure the Ash Road',
      place: 'Cinderhold',
      renown: 0,
      difficulty: 32,
      needed: 32,
      opposition: "Grisk's Warhost (a major noble or beast), and 1 more behind",
      adventures: [{ name: 'Relief for the Ash Road', done: false, percent: 25 }],
      build: null,
      done: false,
      blocked: null,
      pointPrice: 10,
    });
    const wall = v.projects.find((p) => p.id === 'wall-lanternfall');
    expect(wall?.opposition).toBe('the Dawnwall Bastion (local leaders)');
    expect(wall?.build).toEqual({
      crowns: 150,
      days: 20,
      daysLeft: null,
      blocked: 'The work on Wall Lanternfall is done on site, in Lanternfall.',
    });
    expect(wall?.effect).toBe(
      "Raids on Lanternfall fail 50% of the time before they're fought, and a sacking there lasts half a month.",
    );
    expect(wall).toMatchObject({ help: null, askBlocked: null, shut: false, trouble: null });
    // A dungeon to clear is named for it.
    const cisterns = v.projects.find((p) => p.id === 'cinderhold-cisterns');
    expect(cisterns?.adventures).toEqual([
      { name: 'Clear The Drowned Cisterns', done: false, percent: 25 },
    ]);
    // With nothing against it.
    expect(v.projects.find((p) => p.id === 'mirewatch-drains')?.opposition).toBeNull();
  });

  it('shows help asked for and given, a strike pending, and an effect shut', () => {
    const w = inCinderhold();
    w.majorProjects['secure-ash-road'] = {
      ...progressOf(w, 'secure-ash-road'),
      help: [{ faction: 'settlements', points: 12 }],
    };
    w.majorProjects['wall-gutterwick'] = {
      ...progressOf(w, 'wall-gutterwick'),
      help: [{ faction: 'settlements', points: 0 }],
      done: 0,
      trouble: 'bastion',
      shutUntil: w.day + 3,
    };
    const v = projectsView(w, data);
    const road = v.projects.find((p) => p.id === 'secure-ash-road');
    expect(road).toMatchObject({ help: '12 off', difficulty: 20 });
    expect(road?.askBlocked).toBe('The Free Settlements have been asked already.');
    expect(v.projects.find((p) => p.id === 'wall-gutterwick')).toMatchObject({
      help: 'asked',
      shut: true,
      trouble: 'The Dawnwall Bastion',
    });
  });

  it('puts finished projects last, with their ending', () => {
    const w = inCinderhold();
    w.majorProjects['wall-lanternfall'] = {
      renown: 8,
      bought: 0,
      done: 1,
      daysLeft: null,
      help: [],
      trouble: null,
      shutUntil: null,
    };
    w.quests['ash-road-relief'] = { status: 'done', step: 0, acceptedDay: 0 };
    const v = projectsView(w, data);
    const last = v.projects.at(-1);
    expect(last).toMatchObject({ id: 'wall-lanternfall', done: true, renown: 8 });
    expect(last?.blocked).toBe('Wall Lanternfall is finished.');
    expect(v.projects.find((p) => p.id === 'secure-ash-road')?.adventures[0]?.done).toBe(true);
  });

  it('shows nothing outside the campaign', () => {
    const party = [
      { character: starter('snag'), row: 0, column: 0, defaultAction: 'auto' as const },
    ];
    const w = newWorld(data, createRng('realm'), party, undefined, null, 'wastes');
    w.renown = 5;
    expect(projectsView(w, data)).toMatchObject({ renown: 0, projects: [] });
  });
});
