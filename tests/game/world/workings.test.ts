import { describe, expect, it } from 'vitest';
import { beginSiege } from '../../../src/game/factions/siege.ts';
import { sack } from '../../../src/game/factions/strikes.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { coachRoute } from '../../../src/game/world/coach.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { institutionId } from '../../../src/game/world/institution-projects.ts';
import { difficultyNow, progressOf, projectOf } from '../../../src/game/world/major-projects.ts';
import { wallsHold, watered } from '../../../src/game/world/project-effects.ts';
import { startProject } from '../../../src/game/world/crafting.ts';
import { workDay } from '../../../src/game/world/workshop.ts';
import type { World } from '../../../src/game/world/types.ts';
import {
  beginListed,
  beginWorking,
  cannotBegin,
  castsSpells,
  difficultyOf,
  leaders,
  mageScore,
  unmet,
  workingOf,
} from '../../../src/game/world/workings.ts';
import { currentTown } from '../../../src/game/world/town-prices.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, member, starter, world } from './helpers.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';

/** A campaign world in a settlement, Fizzwick a 6th-level High Mage with Magic-1. */
function at(region: string, col: number, row: number): World {
  const w = world();
  enterRegion(w, region, { col, row });
  w.position = { col, row };
  w.purse = 5000;
  const f = member(w, 'Fizzwick');
  f.character = {
    ...f.character,
    classes: { ...f.character.classes, levels: { 'full-high-mage': 6 } },
    skills: { ...f.character.skills, magic: 1 },
  };
  return w;
}
const cinderhold = () => at('dark-lands', 6, 12);
const lanternfall = () => at('dark-lands', 10, 4);
const fizz = (w: World) => member(w, 'Fizzwick').id;
const town = (w: World) => currentTown(w, data) as NonNullable<ReturnType<typeof currentTown>>;

/** A Working standing in a settlement. */
const stands = (w: World, working: string, town: string) =>
  w.workings.push({ working, town, lead: fizz(w), daysLeft: 0, away: 0, done: 0 });

describe('Workings (docs/rules-adaptation.md, Major projects: Workings; SRD 4.8.0)', () => {
  it('reads a Working’s difficulty, and who casts spells', () => {
    expect(() => workingOf(data, 'atlantis')).toThrow('unknown Working atlantis');
    expect(difficultyOf(workingOf(data, 'watch-lamps'))).toBe(12);
    expect(difficultyOf(workingOf(data, 'wall-ward'))).toBe(96);
    const w = cinderhold();
    expect(castsSpells(data, member(w, 'Fizzwick'))).toBe(true);
    expect(castsSpells(data, member(w, 'Snag'))).toBe(false);
    expect(mageScore(data, member(w, 'Fizzwick'))).toBe(12);
    // No Magic skill brings nothing.
    expect(mageScore(data, member(w, 'Snag'))).toBe(0);
    expect(leaders(w, data).map((m) => m.character.name)).toEqual(['Fizzwick']);
  });

  it('stands only where its needs are met: a service, a wall, a coach stop', () => {
    const c = cinderhold();
    const l = lanternfall();
    expect(unmet(c, data, workingOf(data, 'watch-lamps'), town(c))).toBeNull();
    expect(unmet(c, data, workingOf(data, 'heatless-lamps'), town(c))).toBeNull();
    expect(unmet(l, data, workingOf(data, 'heatless-lamps'), town(l))).toBe(
      'It needs a workshop in Lanternfall.',
    );
    l.majorProjects[institutionId('workshop', 'lanternfall')] = {
      ...progressOf(l, 'x'),
      done: 0,
      specialist: 'Orra',
    };
    expect(unmet(l, data, workingOf(data, 'heatless-lamps'), town(l))).toBeNull();
    expect(unmet(c, data, workingOf(data, 'grave-ward'), town(c))).toBeNull();
    expect(unmet(l, data, workingOf(data, 'grave-ward'), town(l))).toBe(
      'It needs a crypt in Lanternfall.',
    );
    expect(unmet(l, data, workingOf(data, 'wall-ward'), town(l))).toBe(
      'It needs a wall built around Lanternfall first.',
    );
    l.majorProjects['wall-lanternfall'] = { ...progressOf(l, 'wall-lanternfall'), done: 0 };
    expect(unmet(l, data, workingOf(data, 'wall-ward'), town(l))).toBeNull();
    expect(unmet(c, data, workingOf(data, 'waystones'), town(c))).toBeNull();
    expect(unmet(l, data, workingOf(data, 'waystones'), town(l))).toBe(
      'It needs a coach stop in Lanternfall.',
    );
  });

  it('is begun by a spellcaster of 6th level, with help to half the difficulty', () => {
    const w = cinderhold();
    expect(cannotBegin(w, data, 'watch-lamps', member(w, 'Snag').id, 0)).toBe(
      'The lead must be a spellcaster of 6th level or more.',
    );
    expect(cannotBegin(w, data, 'watch-lamps', fizz(w), 3)).toBe(
      'No more than 2 hired mages can help.',
    );
    // Fizzwick's 12 makes the watch-lamps' 12 alone, and half the spring's 24 with two hired.
    expect(cannotBegin(w, data, 'watch-lamps', fizz(w), 0)).toBeNull();
    expect(cannotBegin(w, data, 'unfailing-spring', fizz(w), 1)).toBe(
      "Fizzwick can't design it: 12 points, and 6 of help, against 24.",
    );
    expect(cannotBegin(w, data, 'unfailing-spring', fizz(w), 2)).toBeNull();
    // Another spellcaster in the party helps too.
    const lirael = member(w, 'Lirael');
    lirael.character = {
      ...lirael.character,
      classes: { current: 'full-high-mage', levels: { 'full-high-mage': 3 } },
      skills: { ...lirael.character.skills, magic: 2 },
    };
    expect(cannotBegin(w, data, 'unfailing-spring', fizz(w), 0)).toBeNull();
    const l = lanternfall();
    expect(cannotBegin(l, data, 'heatless-lamps', fizz(l), 0)).toBe(
      'It needs a workshop in Lanternfall.',
    );
  });

  it('is refused off the campaign or a settlement, and once one stands there', () => {
    const w = cinderhold();
    stands(w, 'watch-lamps', 'cinderhold');
    expect(cannotBegin(w, data, 'watch-lamps', fizz(w), 0)).toBe(
      'Cinderhold has watch-lamps already.',
    );
    w.dungeon = {} as World['dungeon'];
    expect(cannotBegin(w, data, 'waystones', fizz(w), 0)).toBe(
      'Workings are built in a settlement on the campaign.',
    );
    const party = [
      { character: starter('fizzwick'), row: 0, column: 0, defaultAction: 'auto' as const },
    ];
    const realm = newWorld(data, createRng('realm'), party, undefined, null, 'wastes');
    expect(cannotBegin(realm, data, 'waystones', realm.members[0]?.id as string, 0)).toBe(
      'Workings are built in a settlement on the campaign.',
    );
  });

  it('costs 20 crowns a point, double to halve the time, and the hired mages’ fees', () => {
    const lamps = workingOf(data, 'watch-lamps');
    expect(beginListed(data, lamps, 0, false)).toBe(240);
    expect(beginListed(data, lamps, 2, true)).toBe(680);
    const w = cinderhold();
    w.purse = 100;
    expect(beginWorking(w, data, 'watch-lamps', fizz(w), 0, false)).toMatchObject({ ok: false });
    expect(beginWorking(w, data, 'watch-lamps', member(w, 'Snag').id, 0, false)).toEqual({
      ok: false,
      reason: 'The lead must be a spellcaster of 6th level or more.',
    });
    w.purse = 1000;
    expect(beginWorking(w, data, 'watch-lamps', fizz(w), 0, false)).toEqual({ ok: true });
    expect(w.workings).toEqual([
      {
        working: 'watch-lamps',
        town: 'cinderhold',
        lead: fizz(w),
        daysLeft: 51,
        away: 0,
        done: null,
      },
    ]);
    expect(w.log.at(-1)).toContain(
      'Fizzwick begins watch-lamps in Cinderhold for 240 crowns: 51 days',
    );
    // The waystones' 16 needs a hired mage beside Fizzwick's 12.
    expect(beginWorking(w, data, 'waystones', fizz(w), 1, true)).toEqual({ ok: true });
    expect(w.workings[1]?.daysLeft).toBe(Math.ceil((30 + 7 * 4) / 2));
  });
});

describe('a Working under way (Sam’s calls: the calendar, then one check)', () => {
  function begun(): World {
    const w = cinderhold();
    beginWorking(w, data, 'watch-lamps', fizz(w), 0, false);
    (w.workings[0] as World['workings'][0]).daysLeft = 1;
    return w;
  }

  it('works a day at a time, then finishes on the lead’s check, or takes another week', () => {
    const w = begun();
    emit(w, data, { kind: 'day-passed' });
    expect(w.workings[0]?.daysLeft).toBe(0);
    // Int/Magic at 8: a 2 fails, a 12 holds.
    w.rng = scriptedThen([1, 1], createRng('w'));
    emit(w, data, { kind: 'day-passed' });
    expect(w.workings[0]).toMatchObject({ daysLeft: 7, done: null });
    expect(w.log.some((l) => l.includes("Watch-lamps won't hold yet"))).toBe(true);
    (w.workings[0] as World['workings'][0]).daysLeft = 0;
    w.rng = scriptedThen([6, 6], createRng('w'));
    emit(w, data, { kind: 'day-passed' });
    expect(w.workings[0]?.done).toBe(w.day);
    expect(w.log.some((l) => l.includes('Fizzwick finishes watch-lamps.'))).toBe(true);
    // Done is done.
    emit(w, data, { kind: 'day-passed' });
    expect(w.workings[0]?.done).not.toBeNull();
  });

  it('halts while the lead is dead, or off its map for over a month', () => {
    const w = begun();
    (w.workings[0] as World['workings'][0]).daysLeft = 40;
    member(w, 'Fizzwick').dead = true;
    emit(w, data, { kind: 'day-passed' });
    expect(w.workings[0]?.daysLeft).toBe(40);
    member(w, 'Fizzwick').dead = false;
    enterRegion(w, 'borderlands', { col: 3, row: 8 });
    emit(w, data, { kind: 'day-passed' });
    expect(w.workings[0]).toMatchObject({ daysLeft: 39, away: 1 });
    (w.workings[0] as World['workings'][0]).away = 30;
    emit(w, data, { kind: 'day-passed' });
    expect(w.workings[0]).toMatchObject({ daysLeft: 39, away: 31 });
    enterRegion(w, 'dark-lands', { col: 6, row: 12 });
    emit(w, data, { kind: 'day-passed' });
    expect(w.workings[0]).toMatchObject({ daysLeft: 38, away: 0 });
  });

  it('is destroyed when the settlement is sacked, standing or under way', () => {
    const w = begun();
    stands(w, 'waystones', 'cinderhold');
    stands(w, 'waystones', 'gutterwick');
    sack(w, data, 'cinderhold');
    expect(w.workings.map((s) => s.town)).toEqual(['gutterwick']);
    expect(w.log.at(-1)).toContain('The sack breaks waystones.');
    // A sacking with nothing standing breaks nothing, and other news leaves the work be.
    const lines = w.log.length;
    sack(w, data, 'mirewatch');
    expect(w.log.length).toBe(lines + 1);
    emit(w, data, { kind: 'town-entered', town: 'gutterwick' });
    expect(w.workings).toHaveLength(1);
  });
});

describe('what standing Workings do', () => {
  it('watch-lamps put a siege’s first assault off two weeks', () => {
    const w = lanternfall();
    stands(w, 'watch-lamps', 'lanternfall');
    w.position = { col: 2, row: 2 };
    expect(beginSiege(w, data, 'bastion', 'lanternfall', 'settlements').next).toBe(w.day + 14);
    expect(w.log.at(-1)).toContain('The first assault comes in 14 days.');
  });

  it('a wall-ward adds to the walls, and waystones quiet the coach road', () => {
    const w = lanternfall();
    w.majorProjects['wall-lanternfall'] = { ...progressOf(w, 'wall-lanternfall'), done: 0 };
    expect(wallsHold(w, data, 'lanternfall')).toBe(50);
    stands(w, 'wall-ward', 'lanternfall');
    expect(wallsHold(w, data, 'lanternfall')).toBe(75);
    expect(coachRoute(w, data, 'ash-road').ambushDie).toBe(4);
    stands(w, 'waystones', 'gutterwick');
    expect(coachRoute(w, data, 'ash-road').ambushDie).toBe(8);
  });

  it('an unfailing spring waters the hexes around it', () => {
    const w = at('dark-lands', 12, 4);
    expect(watered(w, data)).toBe(false);
    stands(w, 'unfailing-spring', 'lanternfall');
    expect(watered(w, data)).toBe(true);
    w.position = { col: 15, row: 4 };
    expect(watered(w, data)).toBe(false);
    w.dungeon = {} as World['dungeon'];
    w.position = { col: 10, row: 4 };
    expect(watered(w, data)).toBe(false);
  });

  it('heatless lamps speed the workshop, and a grave-ward keeps the Faithful off a crypt', () => {
    const w = cinderhold();
    stands(w, 'heatless-lamps', 'cinderhold');
    const crafter = member(w, 'Lirael');
    crafter.character = {
      ...crafter.character,
      skills: { ...crafter.character.skills, craft: 1 },
    };
    expect(startProject(w, data, crafter.id, 'torch', 'normal')).toMatchObject({ ok: true });
    (w.projects[0] as World['projects'][0]).daysLeft = 5;
    expect(workDay(w, data)).toEqual({ ok: true });
    expect(w.projects[0]?.daysLeft).toBe(3.75);
    const l = lanternfall();
    const crypt = projectOf(data, institutionId('crypt', 'lanternfall'));
    expect(difficultyNow(l, data, crypt)).toBe(8);
    stands(l, 'grave-ward', 'lanternfall');
    expect(difficultyNow(l, data, crypt)).toBe(2);
  });
});
