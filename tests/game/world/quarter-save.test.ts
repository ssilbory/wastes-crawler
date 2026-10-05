import { describe, expect, it } from 'vitest';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { encounterBattle } from '../../../src/game/world/fight.ts';
import {
  isDarkNow,
  passQuarter,
  settleByFighting,
  settleByLeaving,
} from '../../../src/game/world/quarter.ts';
import { parseWorld, SAVED_LOG_LINES, serializeWorld } from '../../../src/game/world/save.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, starter, world, encounter } from './helpers.ts';

const hikePlan = { kind: 'hike' as const, leader: 'm-2', watcher: 'm-0' };
const thugs = encounter([['thug-or-militia']]);

describe('quarter days', () => {
  it('hikes or camps, checks for encounters, and moves the clock on', () => {
    const w = world([6, 6, 2]);
    w.destination = { col: 4, row: 8 };
    expect(passQuarter(w, data, hikePlan)).toBe(true);
    expect(w).toMatchObject({ position: { col: 4, row: 8 }, quarter: 1 });
    expect(isDarkNow(w, data)).toBe(false);
    w.rng = scriptedRng([2]);
    passQuarter(w, data, { kind: 'camp', activities: {} });
    expect(w.quarter).toBe(2);
    w.quarter = 3;
    expect(isDarkNow(w, data)).toBe(true);
    w.rng = scriptedRng([2, 5]);
    passQuarter(w, data, { kind: 'camp', activities: {} });
    expect(w).toMatchObject({ day: 1, quarter: 0 });
  });

  it('waits on an encounter before the quarter ends', () => {
    const w = world([1, 1, 3, 1, 1, 6, 6, 1, 1, 1, 1]);
    w.position = { col: 5, row: 9 };
    w.camp = 'none';
    passQuarter(w, data, { kind: 'camp', activities: { 'm-0': 'watch' } });
    expect(w.encounter).not.toBeNull();
    expect(w.quarter).toBe(0);
    expect(passQuarter(w, data, hikePlan)).toBe(false);
    expect(settleByLeaving(w, data)).toBe(false);
    w.rng = createRng('fight');
    const fight = encounterBattle(w, data);
    settleByFighting(
      w,
      data,
      fight,
      {
        outcome: 'party',
        rounds: 2,
        deaths: 0,
        battle: fight.battle,
      },
      null,
    );
    expect(w.quarter).toBe(1);
    w.encounter = { ...thugs, hostile: false };
    expect(settleByLeaving(w, data)).toBe(true);
    expect(w.quarter).toBe(2);
    w.encounter = thugs;
    const lost = encounterBattle(w, data);
    settleByFighting(
      w,
      data,
      lost,
      {
        outcome: 'enemy',
        rounds: 2,
        deaths: 0,
        battle: lost.battle,
      },
      null,
    );
    expect(w).toMatchObject({ day: 1, quarter: 0 });
  });
});

describe('new worlds', () => {
  it('needs one to six PCs, and starts in the region’s starting town', () => {
    expect(() => newWorld(data, createRng('x'), [])).toThrow('a party has one to six PCs');
    const w = newWorld(
      data,
      createRng('x'),
      [{ character: starter('snag'), row: 0, column: 0, defaultAction: 'defend' }],
      'borderlands',
    );
    expect(w).toMatchObject({ region: 'borderlands', position: { col: 3, row: 8 }, rations: 12 });
    expect(w.log[0]).toBe('Day 1, morning: The party gathers in Rubblegate.');
  });
});

describe('world saves', () => {
  it('round-trips, continuing the same random stream', () => {
    const w = world();
    w.destination = { col: 4, row: 8 };
    w.encounter = thugs;
    const loaded = parseWorld(serializeWorld(w), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    const back = loaded.world;
    expect(back.rng.int(1, 1000)).toBe(w.rng.int(1, 1000));
    expect({ ...back, rng: null }).toEqual({ ...w, rng: null });
  });

  it('keeps only the latest log lines', () => {
    const w = world();
    w.log = Array.from({ length: SAVED_LOG_LINES + 5 }, (_, i) => `line ${i}`);
    const loaded = parseWorld(serializeWorld(w), data);
    expect(loaded.ok && loaded.world.log[0]).toBe('line 5');
  });

  it('reports bad files, unknown regions, and bad characters', () => {
    expect(parseWorld('{', data)).toEqual({ ok: false, errors: ['not valid JSON'] });
    expect(parseWorld('[]', data)).toEqual({ ok: false, errors: ['not a world save'] });
    expect(parseWorld('{}', data)).toEqual({ ok: false, errors: ['schemaVersion is missing'] });
    expect(parseWorld('{"schemaVersion":99}', data)).toEqual({
      ok: false,
      errors: ['made by a newer version of the game (99)'],
    });
    expect(parseWorld('{"schemaVersion":0}', data)).toEqual({
      ok: false,
      errors: ['no upgrade from schema 0'],
    });
    const empty = parseWorld('{"schemaVersion":2}', data);
    expect(!empty.ok && empty.errors[0]).toMatch(/^region: /);
    const save = JSON.parse(serializeWorld(world()));
    expect(parseWorld(JSON.stringify({ ...save, region: 'atlantis' }), data)).toEqual({
      ok: false,
      errors: ['unknown region atlantis'],
    });
    save.members[0].character = { schemaVersion: 99 };
    expect(parseWorld(JSON.stringify(save), data)).toEqual({
      ok: false,
      errors: ['m-0: made by a newer version of the game (schema 99)'],
    });
  });
});
