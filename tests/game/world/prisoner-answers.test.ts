import { describe, expect, it } from 'vitest';
import { levelOf } from '../../../src/game/dungeon/levels.ts';
import { prisonerAnswer, prisonerQuestions } from '../../../src/game/world/prisoner-answers.ts';
import { knownHexes, regionMap } from '../../../src/game/world/region.ts';
import { rumorsLeft } from '../../../src/game/world/rumors.ts';
import type { World } from '../../../src/game/world/types.ts';
import { below, place, state } from '../dungeon/helpers.ts';
import { data, world } from './helpers.ts';

// docs/rules-adaptation.md, Morale, escape, and surrender: After a surrender (Phase 22).
const LEVEL = 'buried-waterworks-1';

/** The party at 4,2 on the Buried Waterworks' first level. */
function waterworks(): World {
  const w = below();
  Object.assign(state(w), { dungeon: 'buried-waterworks' });
  place(w, LEVEL, 4, 2, 'n');
  return w;
}

const caches = () =>
  levelOf(data, 'buried-waterworks', LEVEL).level.specials.filter((s) => s.kind === 'cache');

describe('what the surrendered tell', () => {
  it('asks of the level below ground and of the land above', () => {
    expect(prisonerQuestions(waterworks())).toEqual(['map', 'boss', 'treasure']);
    expect(prisonerQuestions(world())).toEqual(['land', 'town', 'dungeon']);
  });

  it('gives the layout of the whole level', () => {
    const w = waterworks();
    expect(prisonerAnswer(w, data, 'map')).toBe('They recall every passage of this level.');
    expect(state(w).seen[LEVEL]?.length).toBeGreaterThan(10);
  });

  it('names one vault or hoard at a time, the nearest not yet marked, until none is left', () => {
    const w = waterworks();
    const n = caches().length;
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++)
      expect(prisonerAnswer(w, data, 'treasure')).toMatch(/^They say a (vault|hoard) lies /);
    expect(Object.keys(state(w).located[LEVEL] ?? {})).toHaveLength(n);
    expect(prisonerAnswer(w, data, 'treasure')).toBe(
      'They know of nothing the party has not already marked.',
    );
    w.caches = caches().map((c) => `buried-waterworks/${LEVEL}/${c.at.x},${c.at.y}`);
    expect(prisonerAnswer(w, data, 'treasure')).toBe(
      'They know of no vault or hoard left on this level.',
    );
  });

  it('names the nearest town the party does not know, and charts it', () => {
    const w = world();
    const map = regionMap(data, w.region);
    const unknown = map.sites.filter((s) => !knownHexes(map, w).has(`${s.col},${s.row}`));
    expect(unknown.length).toBeGreaterThan(0);
    for (let i = 0; i < unknown.length; i++) {
      const said = prisonerAnswer(w, data, 'town');
      const at = /lies at (\d+,\d+)\.$/.exec(said)?.[1] as string;
      expect(knownHexes(map, w).has(at)).toBe(true);
    }
    expect(prisonerAnswer(w, data, 'town')).toBe('They know of no town the party has not seen.');
  });

  it('tells of the nearest way down the party has not heard of, as a rumor would', () => {
    const w = world();
    const n = rumorsLeft(w, data).length;
    expect(n).toBeGreaterThan(0);
    for (let i = 0; i < n; i++)
      expect(prisonerAnswer(w, data, 'dungeon')).toMatch(/^They tell of /);
    expect(w.rumors).toHaveLength(n);
    expect(prisonerAnswer(w, data, 'dungeon')).toBe(
      'They know of no way down the party has not heard of.',
    );
  });

  it('names a vault as a vault', () => {
    // The first cache on the level made a vault, for this test alone.
    const dungeons = data.content.dungeons.map((d) =>
      d.id !== 'buried-waterworks'
        ? d
        : {
            ...d,
            levels: d.levels.map((l) =>
              l.id !== LEVEL
                ? l
                : {
                    ...l,
                    specials: l.specials.map((x) =>
                      x.kind === 'cache' ? { ...x, vault: true as const } : x,
                    ),
                  },
            ),
          },
    );
    const withVault = { ...data, content: { ...data.content, dungeons } };
    expect(prisonerAnswer(waterworks(), withVault, 'treasure')).toMatch(/^They say a vault lies /);
  });

  it('tells of a hand-made way down with no party level', () => {
    const w = world();
    Object.assign(w, {
      region: 'wastes-fringe',
      position: { col: 29, row: 20 },
      visited: new Set(),
    });
    expect(prisonerAnswer(w, data, 'dungeon')).toBe(
      'They tell of The Buried Waterworks, at 29,21.',
    );
  });

  it('describe the land about, as the dead do', () => {
    expect(prisonerAnswer(world(), data, 'land')).toBe('They describe the land about.');
  });
});
