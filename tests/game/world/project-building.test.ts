import { describe, expect, it } from 'vitest';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { progressOf } from '../../../src/game/world/major-projects.ts';
import { buildDay, cannotBuild, startBuild } from '../../../src/game/world/project-building.ts';
import { projectOf } from '../../../src/game/world/major-projects.ts';
import type { World } from '../../../src/game/world/types.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, member, world } from './helpers.ts';

/** The four starters in a Dark Lands settlement, with crowns to spend. */
function at(col: number, row: number): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col, row });
  w.position = { col, row };
  w.purse = 1000;
  return w;
}
const mirewatch = () => at(13, 20);

/** Each PC's 2d6 in party order, then anything else from a fixed stream. */
const rolls = (w: World, faces: number[]) => {
  w.rng = scriptedThen(faces, createRng('building'));
};

describe('building work (docs/rules-adaptation.md, Major projects: Building work; Sam’s calls)', () => {
  it('is done on site, only for projects that need it, until they are finished', () => {
    const w = mirewatch();
    expect(cannotBuild(w, data, projectOf(data, 'mirewatch-drains'))).toBeNull();
    expect(cannotBuild(w, data, projectOf(data, 'secure-ash-road'))).toBe(
      'Secure the Ash Road needs no building work.',
    );
    expect(cannotBuild(w, data, projectOf(data, 'wall-lanternfall'))).toBe(
      'The work on Wall Lanternfall is done on site, in Lanternfall.',
    );
    w.majorProjects['mirewatch-drains'] = {
      ...progressOf(w, 'mirewatch-drains'),
      done: 2,
    };
    expect(startBuild(w, data, 'mirewatch-drains')).toEqual({
      ok: false,
      reason: 'Drain the Mirewatch Fields is finished.',
    });
  });

  it('starts once its materials are paid for, through the town’s prices', () => {
    const w = mirewatch();
    w.purse = 50;
    expect(startBuild(w, data, 'mirewatch-drains')).toEqual({
      ok: false,
      reason: 'The materials cost 80 crowns.',
    });
    expect(buildDay(w, data, 'mirewatch-drains')).toEqual({
      ok: false,
      reason: 'Pay for the materials for Drain the Mirewatch Fields first.',
    });
    w.purse = 100;
    expect(startBuild(w, data, 'mirewatch-drains')).toEqual({ ok: true });
    expect(w.purse).toBe(20);
    expect(progressOf(w, 'mirewatch-drains').daysLeft).toBe(10);
    expect(w.log.at(-1)).toContain('80 crowns for Drain the Mirewatch Fields: 10 days of work');
    expect(startBuild(w, data, 'mirewatch-drains')).toEqual({
      ok: false,
      reason: 'The work on Drain the Mirewatch Fields is under way.',
    });
  });

  it('takes a day off for each PC who passes, pays them half an XP, and sleeps at the inn', () => {
    const w = mirewatch();
    startBuild(w, data, 'mirewatch-drains');
    const xp = w.members.map((m) => m.character.xp);
    // Snag and Lirael pass at 8; Grukk and Fizzwick fail.
    rolls(w, [6, 6, 1, 1, 6, 6, 1, 1]);
    const purse = w.purse;
    expect(buildDay(w, data, 'mirewatch-drains')).toEqual({ ok: true });
    expect(progressOf(w, 'mirewatch-drains').daysLeft).toBe(8);
    expect(w.members.map((m, i) => m.character.xp - (xp[i] as number))).toEqual([0.5, 0, 0.5, 0]);
    expect(w.purse).toBeLessThan(purse);
    expect(w.log.some((l) => l.includes('2 days of work done, 8 days left'))).toBe(true);
  });

  it('leaves the dead out, and finishes the work and the project together', () => {
    const w = mirewatch();
    startBuild(w, data, 'mirewatch-drains');
    w.renown = 2;
    w.majorProjects['mirewatch-drains'] = {
      ...progressOf(w, 'mirewatch-drains'),
      renown: 2,
      daysLeft: 2,
    };
    member(w, 'Grukk').dead = true;
    rolls(w, [6, 6, 6, 6, 6, 6]);
    expect(buildDay(w, data, 'mirewatch-drains')).toEqual({ ok: true });
    const s = progressOf(w, 'mirewatch-drains');
    expect(s.daysLeft).toBe(0);
    expect(s.done).toBe(w.day);
    expect(w.log.some((l) => l.includes('finishes the building work on Drain the Mirewatch'))).toBe(
      true,
    );
    expect(buildDay(w, data, 'mirewatch-drains')).toEqual({
      ok: false,
      reason: 'Drain the Mirewatch Fields is finished.',
    });
  });

  it('waits on the Renown when the building is done first', () => {
    const w = mirewatch();
    startBuild(w, data, 'mirewatch-drains');
    w.majorProjects['mirewatch-drains'] = { ...progressOf(w, 'mirewatch-drains'), daysLeft: 0 };
    expect(buildDay(w, data, 'mirewatch-drains')).toEqual({
      ok: false,
      reason: 'The building work on Drain the Mirewatch Fields is done.',
    });
    expect(progressOf(w, 'mirewatch-drains').done).toBeNull();
  });

  it('needs the inn paid for and no encounter pending', () => {
    const w = mirewatch();
    startBuild(w, data, 'mirewatch-drains');
    w.purse = 0;
    expect(buildDay(w, data, 'mirewatch-drains')).toMatchObject({ ok: false });
    expect((buildDay(w, data, 'mirewatch-drains') as { reason: string }).reason).toMatch(
      /^A night at the inn after the work costs \d+(\.\d)? crowns\.$/,
    );
    w.encounter = {} as World['encounter'];
    expect(buildDay(w, data, 'mirewatch-drains')).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    w.encounter = null;
    w.dungeon = {} as World['dungeon'];
    expect(cannotBuild(w, data, projectOf(data, 'mirewatch-drains'))).toBe(
      'The work on Drain the Mirewatch Fields is done on site, in Mirewatch.',
    );
  });

  it('rolls the building’s own skill, or Exert where it is allowed and better', () => {
    // A wall takes Craft (Int or Dex) or Exert (Str or Con); a crypt-style Magic build allows no Exert.
    const w = at(10, 4);
    startBuild(w, data, 'wall-lanternfall');
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, skills: { ...snag.character.skills, craft: 2 } };
    rolls(w, [4, 4, 1, 1, 1, 1, 1, 1]);
    buildDay(w, data, 'wall-lanternfall');
    expect(progressOf(w, 'wall-lanternfall').daysLeft).toBe(19);
    const noExert = {
      ...data,
      content: {
        ...data.content,
        projects: {
          ...data.content.projects,
          projects: data.content.projects.projects.map((p) =>
            p.id === 'wall-lanternfall' && p.build
              ? { ...p, build: { ...p.build, exert: false } }
              : p,
          ),
        },
      },
    };
    rolls(w, [4, 4, 1, 1, 1, 1, 1, 1]);
    buildDay(w, noExert, 'wall-lanternfall');
    expect(progressOf(w, 'wall-lanternfall').daysLeft).toBe(18);
  });
});
