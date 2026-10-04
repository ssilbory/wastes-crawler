import { describe, expect, it } from 'vitest';
import { dungeonReferenceErrors } from '../../../src/data/dungeon-check.ts';
import type { Ruin } from '../../../src/data/schemas/index.ts';
import { dungeonOf, enterDungeon } from '../../../src/game/dungeon/explore.ts';
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
    expect(wayDownHere(w, data)?.name).toBe('The Sunken Chapel');
    expect(entrancesIn(data, 'borderlands').map((e) => e.name)).toContain('The Old Mine');
    w.position = { col: 5, row: 10 };
    expect(wayDownHere(w, data)?.name).toBe('The Old Barrow');
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
