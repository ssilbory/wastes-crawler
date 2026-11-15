import { describe, expect, it } from 'vitest';
import { parseLevelMap, type LevelMap } from '../../../src/data/dungeon-map.ts';
import { dungeonReferenceErrors } from '../../../src/data/dungeon-check.ts';
import { generateRuin } from '../../../src/game/dungeon/generate.ts';
import { dressRuin } from '../../../src/game/dungeon/dress.ts';
import { data } from '../world/helpers.ts';

const { ruinTraps, chests } = data.content;

describe('locked doors and random chests in ruins (Locks and chests)', () => {
  it('keep the layout of a seed, locking only some of its doors', () => {
    for (const ruin of data.content.ruins) {
      const plain = generateRuin(ruin, 3, ruinTraps);
      const dressed = generateRuin(ruin, 3, ruinTraps, chests);
      expect(generateRuin(ruin, 3, ruinTraps, chests)).toEqual(dressed);
      dressed.levels.forEach((level, i) => {
        const before = plain.levels[i] as typeof level;
        expect(level.map.map((r) => r.replaceAll('l', 'd'))).toEqual(before.map);
        expect(level.specials.slice(0, before.specials.length)).toEqual(before.specials);
      });
    }
  });

  it('lock about one door in four, and pass the level checks', () => {
    let doors = 0;
    let locks = 0;
    for (const ruin of data.content.ruins)
      for (let seed = 1; seed <= 10; seed++) {
        const d = generateRuin(ruin, seed, ruinTraps, chests);
        expect(dungeonReferenceErrors({ ...data.content, dungeons: [d] })).toEqual([]);
        for (const l of d.levels) {
          const text = l.map.join('');
          doors += [...text].filter((c) => c === 'd' || c === 'l').length;
          locks += [...text].filter((c) => c === 'l').length;
          const map = (parseLevelMap(l.map) as { ok: true; map: LevelMap }).map;
          expect(map.locked({ x: 0, y: 0 }, 'n')).toBe(false);
        }
      }
    expect(locks / doors).toBeGreaterThan(0.15);
    expect(locks / doors).toBeLessThan(0.35);
  });

  it('set one or two chests a level on free floor, of every kind', () => {
    const kinds = new Set<string>();
    for (const ruin of data.content.ruins)
      for (let seed = 1; seed <= 10; seed++)
        for (const l of generateRuin(ruin, seed, ruinTraps, chests).levels) {
          const found = l.specials.filter((s) => s.kind === 'chest');
          expect(found.length).toBeGreaterThanOrEqual(1);
          expect(found.length).toBeLessThanOrEqual(2);
          const cells = l.specials.map((s) => `${s.at.x},${s.at.y}`);
          expect(new Set(cells).size).toBe(cells.length);
          for (const c of found) {
            if (c.kind !== 'chest') continue;
            kinds.add(c.contents);
            expect(c.loot).toEqual(c.contents === 'loot' ? ruin.cache : undefined);
            expect(l.links.some((x) => x.at.x === c.at.x && x.at.y === c.at.y)).toBe(false);
            expect(l.traps.some((x) => x.at.x === c.at.x && x.at.y === c.at.y)).toBe(false);
          }
        }
    expect([...kinds].sort()).toEqual(['golem', 'loot', 'trapped', 'undead']);
  });
});

describe('dressRuin', () => {
  it('sets chests only on reachable, empty floor', () => {
    const ruin = data.content.ruins[0] as (typeof data.content.ruins)[number];
    // A 3 x 1 strip: the middle cell holds a captive, the east one a post, a sealed cell below.
    const level = {
      id: 'strip',
      name: 'Strip',
      map: ['+-+-+-+', '|     |', '+-+-+-+', '| | | |', '+-+-+-+'],
      links: [],
      wander: null,
      safe: [],
      secrets: [],
      traps: [],
      specials: [],
      captives: [{ at: { x: 1, y: 0 }, captive: 'c', guards: [['g']], text: 't' }],
      garrisons: [{ at: { x: 2, y: 0 }, order: 'o', enemies: [['g']], text: 't' }],
    };
    for (let seed = 1; seed <= 20; seed++) {
      const [dressed] = dressRuin(ruin, seed, [level], chests);
      for (const s of dressed?.specials ?? []) expect(s.at).toEqual({ x: 0, y: 0 });
    }
  });
});
