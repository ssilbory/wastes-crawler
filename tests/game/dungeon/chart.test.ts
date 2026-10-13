import { describe, expect, it } from 'vitest';
import { chartDungeon, layoutOf, recall } from '../../../src/game/dungeon/chart.ts';
import { dungeonOf, enterDungeon, step, takeStairs } from '../../../src/game/dungeon/explore.ts';
import { wipe } from '../../../src/game/world/town.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import type { DungeonChart } from '../../../src/data/schemas/index.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, world } from '../world/helpers.ts';

const entrance = { col: 5, row: 10 };
function below(w: World = world()): World {
  w.position = { ...entrance };
  expect(enterDungeon(w, data)).toEqual({ ok: true });
  return w;
}

describe('charts (docs/rules-adaptation.md, Dungeon exploration: Charts)', () => {
  it('keeps the party’s map when it climbs out, and brings it back down', () => {
    const w = below();
    step(w, data, 'forward');
    step(w, data, 'back');
    const s = w.dungeon as NonNullable<World['dungeon']>;
    const seen = s.seen;
    s.found = { 'barrow-upper': ['1,1,n'] };
    s.glimpsed = { 'barrow-upper': ['1,1,n'] };
    s.sensed = { 'barrow-upper': ['2,2'] };
    s.dug = { 'barrow-upper': ['1,2,w'] };
    s.read = { 'barrow-upper': ['3,3'] };
    s.traps = { 'barrow-upper': { '4,4': 'disarmed', '5,5': 'noticed' } };
    expect(takeStairs(w, data)).toEqual({ ok: true });
    expect(w.charted['old-barrow']).toEqual({
      layout: layoutOf(dungeonOf(data, 'old-barrow')),
      seen,
      found: { 'barrow-upper': ['1,1,n'] },
      glimpsed: { 'barrow-upper': ['1,1,n'] },
      // A disarmed trap is remembered, and set again.
      traps: { 'barrow-upper': { '4,4': 'noticed', '5,5': 'noticed' } },
      sensed: { 'barrow-upper': ['2,2'] },
    });
    w.quarter = 0;
    below(w);
    expect(w.dungeon).toMatchObject({
      seen,
      found: { 'barrow-upper': ['1,1,n'] },
      traps: { 'barrow-upper': { '4,4': 'noticed', '5,5': 'noticed' } },
      // Dug passages close and messages wait to be read again.
      dug: {},
      read: {},
    });
  });

  it('drops a chart whose dungeon has changed', () => {
    const w = world();
    const d = dungeonOf(data, 'old-barrow');
    w.charted[d.id] = { ...recall(w, d), layout: 'deadbeef', seen: { 'barrow-upper': ['1,1'] } };
    expect(recall(w, d).seen).toEqual({});
    w.charted[d.id] = { ...(w.charted[d.id] as DungeonChart), layout: layoutOf(d) };
    expect(recall(w, d).seen).toEqual({ 'barrow-upper': ['1,1'] });
    // Any change to a level's map makes a new layout.
    const changed = {
      ...d,
      levels: d.levels.map((l, i) => (i === 0 ? { ...l, map: [...l.map].reverse() } : l)),
    };
    expect(layoutOf(changed)).not.toBe(layoutOf(d));
    expect(layoutOf(d)).toMatch(/^[0-9a-f]{8}$/);
  });

  it('charts nothing on the surface, and keeps the map of a party that falls below', () => {
    const w = world();
    chartDungeon(w, data);
    expect(w.charted).toEqual({});
    below(w);
    wipe(w, data);
    expect(w.dungeon).toBeNull();
    expect(Object.keys(w.charted)).toEqual(['old-barrow']);
  });

  it('saves its charts, and gives an older save none', () => {
    const w = below();
    takeStairs(w, data);
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.charted).toEqual(w.charted);
    expect(WORLD_MIGRATIONS[34]?.({ schemaVersion: 34 })).toEqual({
      schemaVersion: 35,
      charted: {},
    });
  });
});
