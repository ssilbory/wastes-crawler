import { describe, expect, it } from 'vitest';
import { FURNITURE, type DungeonState } from '../../src/data/schemas/index.ts';
import type { World } from '../../src/game/world/types.ts';
import { automap } from '../../src/render/automap-view.ts';
import { furnitureOf } from '../../src/render/dungeon-furniture.ts';
import { dungeonView, sandboxView } from '../../src/render/dungeon-view.ts';
import { furnitureIn, furnitureParts } from '../../src/render/furniture-art.ts';
import { data, world } from '../game/world/helpers.ts';
import { levelOf } from '../../src/game/dungeon/levels.ts';

function at(x: number, y: number, facing: DungeonState['facing'], seen: string[] = []): World {
  const w = world();
  w.dungeon = {
    dungeon: 'old-barrow',
    level: 'barrow-upper',
    at: { x, y },
    facing,
    seen: { 'barrow-upper': seen },
    turn: 0,
    steps: 0,
    found: {},
    dug: {},
    glimpsed: {},
    traps: {},
    read: {},
    sight: null,
    sensed: {},
    located: {},
  };
  w.light.lit = 'torch';
  w.light.torch = 6;
  return w;
}
const numbers = (d: string) =>
  (d.replace(/a[^A-Za-z]*/g, '').match(/-?\d+(\.\d+)?/g) ?? []).map(Number);

describe('furniture art (docs/presentation-plan.md, V4)', () => {
  it('draws every kind inside its box, standing on its line', () => {
    for (const kind of FURNITURE) {
      const parts = furnitureParts(kind);
      expect(parts.length, kind).toBeGreaterThan(0);
      for (const n of parts.flatMap((p) => numbers(p.d))) {
        expect(n, kind).toBeGreaterThanOrEqual(0);
        expect(n, kind).toBeLessThanOrEqual(48);
      }
    }
    // Fire and water keep their own colours.
    expect(furnitureParts('brazier').some((p) => p.tone === 'flame')).toBe(true);
    expect(furnitureParts('altar').some((p) => p.tone === 'flame')).toBe(true);
    expect(furnitureParts('fountain').some((p) => p.tone === 'water')).toBe(true);
  });

  it('stands mid-cell, a cell wide, smaller with distance', () => {
    const near = furnitureIn('altar', 1, 0);
    const far = furnitureIn('altar', 2, 0);
    expect(near.size).toBeGreaterThan(far.size);
    expect(near.x + near.size / 2).toBeCloseTo(160);
    expect(furnitureIn('altar', 1, 1).x).toBeGreaterThan(near.x);
    // Lit from the middle of the corridor: on its top ahead, on its inner side to either side.
    expect(Math.abs(near.light[0])).toBe(0);
    expect(furnitureIn('altar', 1, 1).light[0]).toBeGreaterThan(0);
    expect(furnitureIn('altar', 1, -1).light[0]).toBeLessThan(0);
    // Its feet (y = 46 of the box) are on the floor line at the middle of the cell.
    expect(near.y + (near.size * 46) / 48).toBeCloseTo(120 + 120 / 2.5);
  });

  it('finds what stands on a cell', () => {
    const on = furnitureOf([{ at: { x: 1, y: 2 }, kind: 'bones' }]);
    expect(on({ x: 1, y: 2 })).toBe('bones');
    expect(on({ x: 2, y: 1 })).toBeNull();
    expect(furnitureOf()({ x: 0, y: 0 })).toBeNull();
  });
});

describe('furniture in the view', () => {
  it('stands a piece a cell ahead, after the far wall and before the side walls', () => {
    // The barrow's bones lie at 0,2; the party looks west at them from 1,2.
    const panels = dungeonView(at(1, 2, 'w'), data);
    const i = panels.findIndex((p) => p.key === 'furniture-1-0');
    expect(panels[i]).toMatchObject({ kind: 'furniture', furniture: { kind: 'bones' } });
    const front = panels.findIndex((p) => p.key.startsWith('front-1-'));
    const side = panels.findIndex((p) => /^(left|right)-1-/.test(p.key));
    expect(front).toBeLessThan(i);
    expect(i).toBeLessThan(side);
  });

  it('leaves out what lies underfoot', () => {
    // Standing on the bones, facing them or not.
    for (const f of ['n', 'e', 's', 'w'] as const)
      expect(dungeonView(at(0, 2, f), data).some((p) => p.key === 'furniture-0-0')).toBe(false);
  });

  it('shows the editor’s furniture on the test walk', () => {
    const { map } = levelOf(data, 'old-barrow', 'barrow-upper');
    const pieces = [{ at: { x: 1, y: 6 }, kind: 'rubble' as const }];
    expect(sandboxView(map, { x: 1, y: 8 }, 'n', [], pieces).map((p) => p.key)).toContain(
      'furniture-2-0',
    );
    expect(sandboxView(map, { x: 1, y: 8 }, 'n').some((p) => p.kind === 'furniture')).toBe(false);
  });

  it('marks furniture on the automap once its cell is seen', () => {
    expect(automap(at(1, 2, 'w', ['1,2']), data)?.furniture).toEqual([]);
    expect(automap(at(1, 2, 'w', ['1,2', '0,2']), data)?.furniture).toEqual([
      { key: '0,2', x: 0, y: 2, kind: 'bones' },
    ]);
  });

  it('marks no furniture on a level that has none', () => {
    const w = at(1, 1, 'n');
    const s = w.dungeon as DungeonState;
    s.dungeon = 'ashgate-keep';
    s.level = 'ashgate-ward';
    s.seen = { 'ashgate-ward': ['1,1'] };
    expect(automap(w, data)?.furniture).toEqual([]);
  });
});
