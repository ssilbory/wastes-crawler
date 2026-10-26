import { describe, expect, it } from 'vitest';
import { crossOver } from '../../../src/game/world/crossing.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { acceptQuest } from '../../../src/game/world/quest-board.ts';
import { regionMap } from '../../../src/game/world/region.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { wipe } from '../../../src/game/world/town.ts';
import { hexCells } from '../../../src/render/hex-view.ts';
import { questTargets } from '../../../src/render/quest-view.ts';
import { data, encounter, world } from './helpers.ts';

const EAST_ROAD = { col: 23, row: 8 };

describe('regions (docs/rules-adaptation.md, Regions in Phase 12)', () => {
  it('lead from the Borderlands into the Dark Lands and back by road', () => {
    const w = world();
    expect(crossOver(w, data)).toEqual({ ok: false, reason: 'No road leaves the map here.' });
    w.position = EAST_ROAD;
    w.visited.add('23,8');
    const quarter = w.quarter;
    expect(crossOver(w, data)).toEqual({ ok: true });
    expect(w.region).toBe('dark-lands');
    expect(w.position).toEqual({ col: 0, row: 12 });
    expect([...w.visited]).toEqual(['0,12']);
    expect(w.elsewhere.borderlands).toContain('23,8');
    expect(w.quarter).toBe(quarter + 1);
    expect(w.log.at(-1)).toContain('The party takes the road: the east road into the Dark Lands.');
    expect(crossOver(w, data)).toEqual({ ok: true });
    expect(w.region).toBe('borderlands');
    expect(w.visited.has('3,8')).toBe(true);
    expect(w.elsewhere).toEqual({ 'dark-lands': ['0,12'] });
  });

  it('refuse mid-encounter or on a coach', () => {
    const w = world();
    w.position = EAST_ROAD;
    w.encounter = encounter([['human-raider']]);
    expect(crossOver(w, data)).toMatchObject({ ok: false });
    w.encounter = null;
    w.coach = { route: 'west-road', to: 'eastmarch', path: [], checkedDay: null };
    expect(crossOver(w, data)).toMatchObject({ ok: false });
  });

  it('wake a fallen party in its last town, whatever region it fell in', () => {
    const w = world();
    enterRegion(w, 'dark-lands', { col: 20, row: 10 });
    wipe(w, data);
    expect(w.region).toBe('borderlands');
    expect(w.position).toEqual({ col: 3, row: 8 });
    w.lastTown = 'atlantis';
    expect(() => wipe(w, data)).toThrow('unknown town atlantis');
  });

  it('show the road off the map once its hex is known', () => {
    const w = world();
    const map = regionMap(data, 'borderlands');
    const road = () => hexCells(map, w, [], 10).find((c) => c.key === '23,8')?.exit;
    expect(road()).toBeNull();
    w.visited.add('23,8');
    expect(road()).toBe('the east road into the Dark Lands');
  });

  it('roll their own encounter tables', () => {
    const dark = regionMap(data, 'dark-lands');
    expect(dark.tableAt({ col: 20, row: 10 })).toBe('dl-badlands');
    expect(dark.tableAt({ col: 30, row: 10 })).toBe('plains');
    expect(dark.exitAt({ col: 0, row: 12 })?.to.region).toBe('borderlands');
    expect(regionMap(data, 'borderlands').tableAt({ col: 3, row: 8 })).toBe('plains');
  });

  it('mark quest steps only on the map the party is on', () => {
    const w = world();
    w.purse = 1000;
    acceptQuest(w, data, 'bandit-camp');
    w.quests['barrow-torc'] = { status: 'active', step: 0, acceptedDay: 0 };
    expect(questTargets(w, data)).toEqual([
      { col: 6, row: 12 },
      { col: 5, row: 10 },
    ]);
    enterRegion(w, 'dark-lands', { col: 6, row: 12 });
    expect(questTargets(w, data)).toEqual([]);
  });

  it('save the other regions’ explored hexes', () => {
    const w = world();
    enterRegion(w, 'dark-lands', { col: 0, row: 12 });
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.elsewhere).toEqual(w.elsewhere);
    expect(back.ok && back.world.region).toBe('dark-lands');
    const save = JSON.parse(serializeWorld(w));
    delete save.elsewhere;
    save.schemaVersion = 13;
    const old = parseWorld(JSON.stringify(save), data);
    expect(old.ok && old.world.elsewhere).toEqual({});
  });
});
