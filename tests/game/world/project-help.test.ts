import { describe, expect, it } from 'vitest';
import { startFactions } from '../../../src/game/factions/state.ts';
import { factionTurn } from '../../../src/game/factions/turn.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import {
  difficultyNow,
  finishCovered,
  progressOf,
  projectOf,
} from '../../../src/game/world/major-projects.ts';
import { askHelp, cannotAsk, projectTurn } from '../../../src/game/world/project-help.ts';
import type { World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, world } from './helpers.ts';

/** A campaign world in Cinderhold, where the Free Settlements keep a guard, factions started. */
function inCinderhold(): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 6, row: 12 });
  w.position = { col: 6, row: 12 };
  startFactions(w, data);
  return w;
}

const free = (w: World) => w.factions.settlements as NonNullable<World['factions'][string]>;

describe('faction help (SRD 7.9.0 at half strength; Sam’s call: ask in their town)', () => {
  it('is asked for in a town the faction holds, for a project on its map, once', () => {
    const w = inCinderhold();
    expect(cannotAsk(w, data, 'secure-ash-road')).toBeNull();
    expect(cannotAsk(w, data, 'secure-west-road')).toBe(
      'The Free Settlements help only with projects on their own map.',
    );
    expect(askHelp(w, data, 'secure-ash-road')).toEqual({ ok: true });
    expect(progressOf(w, 'secure-ash-road').help).toEqual([{ faction: 'settlements', points: 0 }]);
    expect(w.log.at(-1)).toContain('agree to help with Secure the Ash Road next month');
    expect(askHelp(w, data, 'secure-ash-road')).toEqual({
      ok: false,
      reason: 'The Free Settlements have been asked already.',
    });
  });

  it('is refused where the faction holds nothing, underground, once done, or when it has fallen', () => {
    const w = inCinderhold();
    w.position = { col: 7, row: 12 };
    expect(cannotAsk(w, data, 'secure-ash-road')).toBe(
      'Ask The Free Settlements in a town they hold.',
    );
    w.position = { col: 6, row: 12 };
    w.dungeon = {} as World['dungeon'];
    expect(cannotAsk(w, data, 'secure-ash-road')).toBe(
      'Ask The Free Settlements in a town they hold.',
    );
    w.dungeon = null;
    w.majorProjects['wall-gutterwick'] = { ...progressOf(w, 'wall-gutterwick'), done: 1 };
    expect(cannotAsk(w, data, 'wall-gutterwick')).toBe('Wall Gutterwick is finished.');
    free(w).hp = 0;
    expect(cannotAsk(w, data, 'secure-ash-road')).toBe(
      "The Free Settlements can't help anyone now.",
    );
    // A town the faction no longer holds anything in won't do.
    const lost = inCinderhold();
    // Cinderhold is their headquarters, and a guard of theirs stands there.
    free(lost).assets = free(lost).assets.filter((a) => a.at !== 'cinderhold');
    free(lost).bases = free(lost).bases.filter((b) => b.at !== 'cinderhold');
    expect(cannotAsk(lost, data, 'secure-ash-road')).toBe(
      'Ask The Free Settlements in a town they hold.',
    );
    // A town held by a base, not only an asset, counts too.
    const g = inCinderhold();
    g.position = { col: 16, row: 15 };
    expect(cannotAsk(g, data, 'wall-gutterwick')).toBeNull();
  });

  it('takes the faction’s next action and a Treasure, doubled for a project that suits it', () => {
    const w = inCinderhold();
    askHelp(w, data, 'secure-ash-road');
    const treasure = free(w).treasure;
    expect(projectTurn(w, data, 'settlements')).toBe(true);
    // Force 4, Cunning 2, Wealth 5: half is 6, doubled for a road.
    expect(progressOf(w, 'secure-ash-road').help).toEqual([{ faction: 'settlements', points: 12 }]);
    expect(free(w).treasure).toBe(treasure - 1);
    expect(difficultyNow(w, data, projectOf(data, 'secure-ash-road'))).toBe(20);
    expect(w.log.at(-1)).toContain('put their weight behind Secure the Ash Road: 12 off');
    // Nothing more is asked, so the next turn is its own.
    expect(projectTurn(w, data, 'settlements')).toBe(false);
  });

  it('gives no more than half to a project that doesn’t suit it, and waits for Treasure', () => {
    const w = inCinderhold();
    askHelp(w, data, 'end-grisks-tithe');
    free(w).treasure = 0;
    expect(projectTurn(w, data, 'settlements')).toBe(false);
    expect(w.log.at(-1)).toContain("no Treasure to spare for End Grisk's Tithe");
    free(w).treasure = 3;
    expect(projectTurn(w, data, 'settlements')).toBe(true);
    expect(progressOf(w, 'end-grisks-tithe').help[0]?.points).toBe(6);
  });

  it('skips help asked for a project finished since', () => {
    const w = inCinderhold();
    askHelp(w, data, 'secure-ash-road');
    w.majorProjects['secure-ash-road'] = { ...progressOf(w, 'secure-ash-road'), done: 1 };
    expect(projectTurn(w, data, 'settlements')).toBe(false);
  });

  it('comes in the monthly faction turn, in place of the faction’s own action', () => {
    const w = inCinderhold();
    askHelp(w, data, 'secure-ash-road');
    factionTurn(w, data);
    expect(progressOf(w, 'secure-ash-road').help[0]?.points).toBe(12);
  });
});

describe('lingering trouble (SRD 7.6.0; Sam’s call: the faction strikes the place)', () => {
  /** The Ash Road pushed through the Warhost, still standing. */
  function pushedThrough(): World {
    const w = inCinderhold();
    w.majorProjects['secure-ash-road'] = { ...progressOf(w, 'secure-ash-road'), renown: 32 };
    finishCovered(w, data);
    return w;
  }

  it('leaves the faction still standing against the project set to strike', () => {
    const w = pushedThrough();
    expect(progressOf(w, 'secure-ash-road')).toMatchObject({ done: w.day, trouble: 'warhost' });
    // Opposition with no faction behind it (the coast raiders) holds no grudge.
    const quiet = inCinderhold();
    enterRegion(quiet, 'borderlands', { col: 3, row: 8 });
    quiet.majorProjects['secure-west-road'] = {
      ...progressOf(quiet, 'secure-west-road'),
      renown: 8,
    };
    finishCovered(quiet, data);
    expect(progressOf(quiet, 'secure-west-road')).toMatchObject({ done: 0, trouble: null });
  });

  it('sacks the place and shuts the effect for a month when the strike lands', () => {
    const w = pushedThrough();
    w.rng = scriptedRng([10, 1]);
    expect(projectTurn(w, data, 'warhost')).toBe(true);
    const s = progressOf(w, 'secure-ash-road');
    expect(s.trouble).toBeNull();
    expect(s.shutUntil).toBe(w.day + 1 + 30);
    expect(w.raided.cinderhold).toBe(w.day + 1 + 30);
    expect(w.log.some((l) => l.includes("Grisk's Warhost struck at Cinderhold"))).toBe(true);
    expect(w.log.at(-1)).toContain('Secure the Ash Road does nothing for a month.');
  });

  it('is driven off when the strike fails, against the faction holding the place', () => {
    const w = pushedThrough();
    w.rng = scriptedRng([1, 10]);
    expect(projectTurn(w, data, 'warhost')).toBe(true);
    expect(progressOf(w, 'secure-ash-road')).toMatchObject({ trouble: null, shutUntil: null });
    expect(w.log.at(-1)).toContain('and were driven off');
    // Gutterwick is a Free Settlements base: its Force defends the place.
    const g = inCinderhold();
    g.majorProjects['wall-gutterwick'] = {
      ...progressOf(g, 'wall-gutterwick'),
      done: 0,
      trouble: 'bastion',
    };
    // Bastion Force 5 + 3 ties the Free Settlements' Force 4 + 4; without them it would land.
    g.rng = scriptedRng([3, 4]);
    expect(projectTurn(g, data, 'bastion')).toBe(true);
    expect(g.log.at(-1)).toContain('driven off');
    // A holder that has fallen defends nothing.
    g.majorProjects['wall-gutterwick'] = {
      ...progressOf(g, 'wall-gutterwick'),
      trouble: 'bastion',
    };
    free(g).hp = 0;
    g.rng = scriptedRng([3, 4]);
    projectTurn(g, data, 'bastion');
    expect(g.log.at(-1)).toContain('Wall Gutterwick does nothing for a month.');
  });
});
