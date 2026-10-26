import { describe, expect, it } from 'vitest';
import type { Ruin } from '../../../src/data/schemas/index.ts';
import { generateRuin } from '../../../src/game/dungeon/generate.ts';
import {
  decorate,
  framed,
  maze,
  pair,
  type Cell,
  type Edges,
} from '../../../src/game/dungeon/maze.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data } from '../world/helpers.ts';

const cells = (key: string) =>
  key.split('|').map((c) => {
    const [x, y] = c.split(',').map(Number) as [number, number];
    return { x, y };
  }) as [Cell, Cell];

describe('generated doors (docs/decisions/0004-procedural-levels.md)', () => {
  it('stand only where walls meet both ends', () => {
    for (let seed = 0; seed < 400; seed++) {
      const rng = createRng(`doors:${seed}`);
      const [w, h] = [rng.int(3, 9), rng.int(3, 9)];
      const edges = maze(rng, w, h);
      decorate(rng, edges, w, h);
      for (const [key, glyph] of edges)
        if (glyph !== ' ') expect(framed(edges, w, h, ...cells(key)), `${seed} ${key}`).toBe(true);
    }
  });

  it('counts the border as a wall, and an open corner as none', () => {
    const open: Edges = new Map(
      [
        [
          { x: 0, y: 0 },
          { x: 0, y: 1 },
        ],
        [
          { x: 1, y: 0 },
          { x: 1, y: 1 },
        ],
        [
          { x: 0, y: 1 },
          { x: 1, y: 1 },
        ],
      ].map(([a, b]) => [pair(a as Cell, b as Cell), ' ' as const]),
    );
    // Between the top two cells of a 2 x 2 room: the border frames the top, nothing the bottom.
    expect(framed(open, 2, 2, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(false);
    open.delete(pair({ x: 0, y: 1 }, { x: 1, y: 1 }));
    expect(framed(open, 2, 2, { x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
    // The same for a horizontal edge between the left two cells.
    expect(framed(new Map(), 2, 2, { x: 0, y: 0 }, { x: 0, y: 1 })).toBe(true);
  });

  it('builds the towers that once ran out of walls for a secret door', () => {
    const spire = data.content.ruins.find((r) => r.id === 'watchers-spire') as Ruin;
    expect(() => generateRuin(spire, 499, data.content.ruinTraps)).not.toThrow();
    expect(() => generateRuin(spire, 1549, data.content.ruinTraps)).not.toThrow();
  });
});
