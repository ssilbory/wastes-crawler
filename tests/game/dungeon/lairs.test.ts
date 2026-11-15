import { describe, expect, it } from 'vitest';
import { parseLevelMap, type LevelMap } from '../../../src/data/dungeon-map.ts';
import { dungeonReferenceErrors } from '../../../src/data/dungeon-check.ts';
import type { Ruin } from '../../../src/data/schemas/index.ts';
import { enterDungeon, goesDown } from '../../../src/game/dungeon/explore.ts';
import { generateRuin } from '../../../src/game/dungeon/generate.ts';
import { dungeonOf } from '../../../src/game/dungeon/levels.ts';
import { atGuardedHoard } from '../../../src/game/dungeon/ruins.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import type { World } from '../../../src/game/world/types.ts';
import { occupantsOf } from '../../../src/render/dungeon-occupants.ts';
import { data, world } from '../world/helpers.ts';
import { place } from './helpers.ts';

const lairs = data.content.ruins.filter((r) => r.kind === 'lair');
const { ruinTraps, chests } = data.content;
const mapOf = (rows: string[]) => (parseLevelMap(rows) as { ok: true; map: LevelMap }).map;

describe('lairs (docs/rules-adaptation.md, Lairs)', () => {
  it('ship a few, each with minions and a boss over its vault', () => {
    expect(lairs.length).toBeGreaterThanOrEqual(4);
    for (const r of lairs) {
      expect(r.minions?.length).toBeGreaterThan(0);
      expect(r.vault.text).toBeDefined();
    }
  });

  it('run in a straight line of rooms from the stairs to the boss, and pass the level checks', () => {
    for (const r of lairs)
      for (let seed = 1; seed <= 25; seed++) {
        const d = generateRuin(r, seed, ruinTraps, chests);
        expect(dungeonReferenceErrors({ ...data.content, dungeons: [d] })).toEqual([]);
        expect(d.levels).toHaveLength(r.depth);
        d.levels.forEach((level, i) => {
          const map = mapOf(level.map);
          expect(map.height).toBe(5);
          expect(map.width).toBeGreaterThanOrEqual(r.size.min);
          expect(map.width).toBeLessThanOrEqual(r.size.max);
          expect(level.links[0]?.at).toEqual({ x: 0, y: 2 });
          // Traps lie in the corridors, on the middle row with walls above and below.
          for (const t of level.traps) {
            expect(t.at.y).toBe(2);
            expect(map.edge(t.at, 'n')).toBe('wall');
            expect(map.edge(t.at, 's')).toBe('wall');
          }
          const bands = level.specials.filter((s) => s.kind === 'guards');
          const xs = bands.map((b) => b.at.x);
          expect([...xs].sort((a, b) => a - b)).toEqual(xs);
          for (const b of bands) {
            if (b.kind !== 'guards') continue;
            expect(r.minions).toContainEqual(b.enemies);
            expect(b.text).toBe(r.minionText);
          }
          const vault = level.specials.find((s) => s.kind === 'cache' && s.vault);
          const bottom = i === r.depth - 1;
          expect(vault !== undefined).toBe(bottom);
          // The boss waits at the far end, past every band.
          const end = bottom ? vault?.at : level.links[1]?.at;
          expect(end?.x).toBe(map.width - 1);
          for (const b of bands) expect(b.at.x).toBeLessThan(end?.x as number);
        });
      }
  });

  it('use a default line for minions with no words of their own', () => {
    const r = lairs.find((x) => x.depth === 2) as Ruin;
    const { minionText: _, ...plain } = r;
    void _;
    const d = generateRuin(plain as Ruin, 3, ruinTraps);
    const band = d.levels.flatMap((l) => l.specials).find((s) => s.kind === 'guards');
    expect(band?.kind === 'guards' && band.text).toBe(
      'The lair’s creatures rise to meet the party.',
    );
  });

  it('go down, raise each band of minions once until beaten, and keep the boss for the vault', () => {
    const r = lairs[0] as Ruin;
    const w = world();
    enterRegion(w, r.region, r);
    expect(enterDungeon(w, data)).toEqual({ ok: true });
    const id = (w.dungeon as NonNullable<typeof w.dungeon>).dungeon;
    expect(goesDown(data, id)).toBe(true);
    const level = dungeonOf(data, id).levels[0] as ReturnType<typeof dungeonOf>['levels'][number];
    const band = level.specials.find((s) => s.kind === 'guards');
    if (band?.kind !== 'guards') throw new Error('no band');
    place(w, level.id, band.at.x, band.at.y, 'e');
    const key = `${id}/${level.id}/${band.at.x},${band.at.y}`;
    expect(occupantsOf(w, data).get(`${band.at.x},${band.at.y}`)).toMatchObject({
      kind: 'garrison',
    });
    emit(w, data, { kind: 'cell-entered' });
    expect(w.encounter?.enemies).toEqual(band.enemies);
    expect(w.encounter?.text).toContain(band.text);
    expect(w.encounter?.garrison).toBe(key);
    // Not a boss fight: no chest for minions.
    expect(atGuardedHoard(w, data)).toBe(false);
    // Another step here while they stand meets nothing new.
    emit(w, data, { kind: 'cell-entered' });
    w.encounter = null;
    emit(w, data, { kind: 'fight-won', quest: null, garrison: key });
    expect(w.beaten).toContain(key);
    expect(occupantsOf(w, data).has(`${band.at.x},${band.at.y}`)).toBe(false);
    emit(w, data, { kind: 'cell-entered' });
    expect(w.encounter).toBeNull();
    const vault = level.specials.find((s) => s.kind === 'cache' && s.vault);
    if (vault?.kind !== 'cache') throw new Error('no vault');
    place(w, level.id, vault.at.x, vault.at.y, 'e');
    emit(w, data, { kind: 'cell-entered' });
    expect((w.encounter as World['encounter'])?.text).toContain(r.vault.text);
    expect(atGuardedHoard(w, data)).toBe(true);
  });
});
