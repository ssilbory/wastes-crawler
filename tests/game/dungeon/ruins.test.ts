import { describe, expect, it } from 'vitest';
import { dungeonReferenceErrors } from '../../../src/data/dungeon-check.ts';
import type { LevelMap } from '../../../src/data/dungeon-map.ts';
import type { Ruin } from '../../../src/data/schemas/index.ts';
import {
  dungeonOf,
  enterDungeon,
  exitLabel,
  goesDown,
  levelOf,
  openFacing,
  takeStairs,
} from '../../../src/game/dungeon/explore.ts';
import { generateRuin, ruinDungeon, ruinDungeonId } from '../../../src/game/dungeon/generate.ts';
import {
  entrancesIn,
  openRuin,
  ruinHere,
  ruinsListener,
  wayDownHere,
} from '../../../src/game/dungeon/ruins.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import type { World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, world } from '../world/helpers.ts';
import { place } from './helpers.ts';

const ruinOf = (id: string) => data.content.ruins.find((r) => r.id === id) as Ruin;
const CHAPEL = ruinOf('sunken-chapel');
const CRYPTS = ruinOf('gallows-crypts');

/** The party on a ruin's hex. */
function atRuin(ruin: Ruin): World {
  const w = world();
  enterRegion(w, ruin.region, ruin);
  return w;
}

describe('the ruin generator (ADR 0004)', () => {
  it('makes the same valid dungeon from the same seed, and another from another', () => {
    const a = generateRuin(CRYPTS, 7);
    expect(generateRuin(CRYPTS, 7)).toEqual(a);
    expect(generateRuin(CRYPTS, 8).levels[0]?.map).not.toEqual(a.levels[0]?.map);
    expect(a.id).toBe('gallows-crypts-v7');
    expect(a.levels.map((l) => l.id)).toEqual([
      'gallows-crypts-1',
      'gallows-crypts-2',
      'gallows-crypts-3',
    ]);
    for (const ruin of data.content.ruins)
      for (let seed = 1; seed <= 30; seed++)
        expect(
          dungeonReferenceErrors({ ...data.content, dungeons: [generateRuin(ruin, seed)] }),
        ).toEqual([]);
  });

  it('thickens the traps level by level, with caches, and a guarded vault at the bottom', () => {
    const d = generateRuin(CRYPTS, 3);
    expect(d.levels.map((l) => l.traps.length)).toEqual([1, 2, 3]);
    const caches = d.levels.map((l) => l.specials.filter((s) => s.kind === 'cache'));
    for (const c of caches.slice(0, 2))
      expect(c.every((s) => s.kind === 'cache' && !s.vault)).toBe(true);
    const vault = caches[2]?.find((s) => s.kind === 'cache' && s.vault);
    expect(vault).toMatchObject({ guards: CRYPTS.vault.guards, component: 'grave-garnet' });
    // A ruin with no component leaves it out.
    const plain = generateRuin({ ...CHAPEL, vault: { ...CHAPEL.vault, component: undefined } }, 1);
    expect(plain.levels[0]?.specials.find((s) => s.kind === 'cache' && s.vault)).not.toHaveProperty(
      'component',
    );
  });

  it('finds generated dungeons by id, and nothing for other ids', () => {
    expect(ruinDungeon(data.content.ruins, 'gallows-crypts-v7')).toBe(
      ruinDungeon(data.content.ruins, 'gallows-crypts-v7'),
    );
    expect(dungeonOf(data, 'gallows-crypts-v7').name).toBe('The Gallows Crypts');
    expect(ruinDungeon(data.content.ruins, 'atlantis-v1')).toBeUndefined();
    expect(ruinDungeon(data.content.ruins, 'old-barrow')).toBeUndefined();
    expect(ruinDungeonId(CHAPEL, 4)).toBe('sunken-chapel-v4');
  });
});

describe('ruins in play (docs/rules-adaptation.md, Ruins)', () => {
  it('are found on their hexes and shown on the map', () => {
    const w = atRuin(CHAPEL);
    expect(ruinHere(w, data)?.id).toBe('sunken-chapel');
    expect(wayDownHere(w, data)).toEqual({ name: 'The Sunken Chapel', level: 1 });
    expect(entrancesIn(data, 'borderlands').map((e) => e.name)).toContain('The Old Mine');
    w.position = { col: 5, row: 10 };
    expect(wayDownHere(w, data)).toEqual({ name: 'The Old Barrow', level: null });
  });

  it('draw a seed on the first visit and keep the layout', () => {
    const w = atRuin(CHAPEL);
    expect(enterDungeon(w, data)).toEqual({ ok: true });
    const seed = w.ruins['sunken-chapel']?.seed as number;
    expect(w.dungeon?.dungeon).toBe(`sunken-chapel-v${seed}`);
    expect(w.log.join('\n')).toContain('The party goes down into The Sunken Chapel.');
    expect(openRuin(w, data, CHAPEL).id).toBe(`sunken-chapel-v${seed}`);
  });

  it('skip a seed whose layout fails validation', () => {
    const broken: Ruin = { ...CHAPEL, wander: { every: 2, table: 'nowhere' } };
    const fixed = { ...data, content: { ...data.content, ruins: [broken] } };
    const w = atRuin(CHAPEL);
    w.rng = scriptedRng([2 ** 31 - 1]);
    // Every layout of this broken ruin fails, so stop the search after a few tries.
    let tries = 0;
    const content = {
      ...fixed.content,
      get dungeons() {
        tries += 1;
        if (tries > 3) throw new Error('searched');
        return [];
      },
    };
    expect(() => openRuin(w, { ...fixed, content }, broken)).toThrow('searched');
  });

  it('give up each cache once, and a vault only after its guards fall', () => {
    const w = atRuin(CHAPEL);
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Aldo', true);
    enterDungeon(w, data);
    const d = dungeonOf(data, w.dungeon?.dungeon as string);
    const level = d.levels[0] as (typeof d.levels)[0];
    const cache = level.specials.find((s) => s.kind === 'cache' && !s.vault);
    const vault = level.specials.find((s) => s.kind === 'cache' && s.vault);
    if (!cache || !vault) throw new Error('no caches');
    w.loot = [];
    place(w, level.id, cache.at.x, cache.at.y, 'n');
    emit(w, data, { kind: 'cell-entered' });
    expect(w.loot).toEqual([{ count: 1, sides: 6 }]);
    expect(w.npcs[0]?.owed).toBeGreaterThan(0);
    emit(w, data, { kind: 'cell-entered' });
    expect(w.loot).toEqual([{ count: 1, sides: 6 }]);
    place(w, level.id, vault.at.x, vault.at.y, 'n');
    emit(w, data, { kind: 'cell-entered' });
    expect(w.encounter?.text).toContain('Guards stand over a vault.');
    const key = w.encounter?.garrison as string;
    // A pending encounter holds everything back.
    emit(w, data, { kind: 'cell-entered' });
    w.encounter = null;
    // A fight elsewhere doesn't open it.
    ruinsListener(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.caches).toHaveLength(1);
    emit(w, data, { kind: 'fight-won', quest: null, garrison: key });
    expect(w.caches).toHaveLength(2);
    expect(w.components['grave-garnet']).toBe(1);
    expect(w.ruins['sunken-chapel']?.emptied).toBe(w.day);
    expect(w.log.join('\n')).toContain('The Sunken Chapel is emptied.');
    // Other events and other places do nothing.
    ruinsListener(w, data, { kind: 'day-passed' });
    w.dungeon = null;
    ruinsListener(w, data, { kind: 'cell-entered' });
  });

  it('shift a month after the vault is emptied', () => {
    const w = atRuin(CHAPEL);
    w.ruins['sunken-chapel'] = { seed: 5, emptied: 0 };
    w.day = 29;
    expect(openRuin(w, data, CHAPEL).id).toBe('sunken-chapel-v5');
    w.day = 30;
    w.rng = scriptedRng([9]);
    expect(openRuin(w, data, CHAPEL).id).toBe('sunken-chapel-v9');
    expect(w.ruins['sunken-chapel']).toEqual({ seed: 9, emptied: null });
    expect(w.log.at(-1)).toContain('The Sunken Chapel has shifted');
  });

  it('name a component the content lacks by its id', () => {
    const odd = { ...CHAPEL, vault: { ...CHAPEL.vault, component: 'mystery' } };
    const d = { ...data, content: { ...data.content, ruins: [odd] } };
    const w = atRuin(CHAPEL);
    enterDungeon(w, d);
    const level = dungeonOf(d, w.dungeon?.dungeon as string).levels[0] as {
      id: string;
      specials: { kind: string; at: { x: number; y: number }; vault?: true }[];
    };
    const vault = level.specials.find((s) => s.kind === 'cache' && s.vault) as {
      at: { x: number; y: number };
    };
    place(w, level.id, vault.at.x, vault.at.y, 'n');
    w.beaten.push(`${w.dungeon?.dungeon}/${level.id}/${vault.at.x},${vault.at.y}`);
    emit(w, d, { kind: 'cell-entered' });
    expect(w.log.join('\n')).toContain('The party takes mystery.');
  });
});

describe('towers and ruined cities (Sam’s call)', () => {
  const SPIRE = ruinOf('black-spire');
  const DUSKMERE = ruinOf('duskmere');
  const WESTGATE = ruinOf('old-westgate');

  it('climb a tower floor by floor to a vault at the top', () => {
    const d = generateRuin(SPIRE, 2);
    expect(d.levels.map((l) => l.name)).toEqual([
      'The Black Spire, floor 1',
      'The Black Spire, floor 2',
      'The Black Spire, floor 3',
      'The Black Spire, floor 4',
    ]);
    // The ground floor's way out and every way on are stairs up; above it, stairs down lead back.
    const glyph = (i: number, at: { x: number; y: number }) =>
      d.levels[i]?.map[2 * at.y + 1]?.[2 * at.x + 1];
    for (const [i, l] of d.levels.entries())
      for (const link of l.links) {
        const to = link.to;
        const back = 'surface' in to || d.levels.findIndex((x) => x.id === to.level) < i;
        expect(glyph(i, link.at)).toBe(back && i > 0 ? '>' : '<');
      }
    expect(d.levels[3]?.specials.some((s) => s.kind === 'cache' && s.vault)).toBe(true);
  });

  it('lay out a city as streets and buildings, its vault in the biggest building', () => {
    const d = generateRuin(WESTGATE, 4);
    expect(d.levels).toHaveLength(1);
    const [street] = d.levels;
    expect(street?.name).toBe('Old Westgate, the streets');
    expect(street?.links).toEqual([{ at: d.entry.at, to: { surface: true } }]);
    expect(street?.traps).toHaveLength(2);
    expect(street?.specials.filter((s) => s.kind === 'cache' && s.vault)).toHaveLength(1);
  });

  it('put a sewer under some cities, with two manholes and the vault below', () => {
    const d = generateRuin(DUSKMERE, 4);
    expect(d.levels.map((l) => l.id)).toEqual(['duskmere-streets', 'duskmere-sewer']);
    const [street, sewer] = d.levels;
    expect(street?.links.filter((l) => 'level' in l.to)).toHaveLength(2);
    expect(sewer?.links).toHaveLength(2);
    expect(street?.specials.some((s) => s.kind === 'cache' && s.vault)).toBe(false);
    expect(sewer?.specials.some((s) => s.kind === 'cache' && s.vault)).toBe(true);
  });

  it('pass the level validation, every kind, under many seeds', () => {
    for (const ruin of [SPIRE, DUSKMERE, WESTGATE, ruinOf('watchers-spire')])
      for (let seed = 1; seed <= 40; seed++)
        expect(
          dungeonReferenceErrors({ ...data.content, dungeons: [generateRuin(ruin, seed)] }),
        ).toEqual([]);
  });

  it('are walked into and out of, while delves are climbed (Phase 16 polish)', () => {
    const w = atRuin(SPIRE);
    expect(enterDungeon(w, data)).toEqual({ ok: true });
    const id = (w.dungeon as NonNullable<World['dungeon']>).dungeon;
    expect(w.log.join('\n')).toContain('The party enters The Black Spire.');
    expect(exitLabel(data, id)).toBe('Leave The Black Spire');
    expect(takeStairs(w, data)).toEqual({ ok: true });
    expect(w.log.join('\n')).toContain('The party leaves The Black Spire.');
    expect(goesDown(data, 'old-barrow')).toBe(true);
    expect(exitLabel(data, 'old-barrow')).toMatch(/^Climb out of /);
    const crypts = atRuin(CRYPTS);
    enterDungeon(crypts, data);
    expect(crypts.log.join('\n')).toMatch(/The party goes down into /);
  });

  it('turn right, left, then around to find a way, and keep the facing if walled in', () => {
    const only = (open: string) =>
      ({ edge: (_: unknown, f: string) => (f === open ? 'open' : 'wall') }) as unknown as LevelMap;
    const at = { x: 0, y: 0 };
    expect(openFacing(only('e'), at, 'n')).toBe('e');
    expect(openFacing(only('w'), at, 'n')).toBe('w');
    expect(openFacing(only('s'), at, 'n')).toBe('s');
    expect(openFacing(only('none'), at, 'n')).toBe('n');
  });

  it('face the party away from walls on arrival', () => {
    for (const ruin of [SPIRE, DUSKMERE, WESTGATE, CRYPTS])
      for (let i = 0; i < 6; i++) {
        const w = atRuin(ruin);
        w.rng = scriptedRng([i + 1, ...Array(40).fill(3)]);
        enterDungeon(w, data);
        const s = w.dungeon as NonNullable<World['dungeon']>;
        const edge = levelOf(data, s.dungeon, s.level).map.edge(s.at, s.facing);
        expect(['open', 'door']).toContain(edge);
      }
  });

  it('can be entered from the map', () => {
    const w = atRuin(DUSKMERE);
    expect(wayDownHere(w, data)?.name).toBe('Duskmere, the Sacked City');
    expect(enterDungeon(w, data)).toEqual({ ok: true });
    expect(w.log.join('\n')).toContain('The party reaches Duskmere, the Sacked City, the streets.');
  });
});
