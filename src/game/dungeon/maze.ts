// Building blocks for the ruin generators (docs/decisions/0004-procedural-levels.md): cells and the
// edges between them, mazes, distances, traps, caches, and rendering to the doubled ASCII format
// (ADR 0003).
import type { DungeonLevel, Facing, Ruin, Trap } from '../../data/schemas/index.ts';
import type { Rng } from '../../rules/rng.ts';

export type Cell = { x: number; y: number };
const SIDES: readonly [Facing, number, number][] = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
];
/** The glyph on the edge between two cells, keyed by the pair. */
export type Edges = Map<string, ' ' | 'd' | 's'>;
export const pair = (a: Cell, b: Cell) =>
  a.y < b.y || (a.y === b.y && a.x < b.x)
    ? `${a.x},${a.y}|${b.x},${b.y}`
    : `${b.x},${b.y}|${a.x},${a.y}`;

export const TRAPS: readonly Omit<Trap, 'at'>[] = [
  {
    name: 'dart trap',
    notice: 8,
    disarm: { skill: 'sneak', attributes: ['dex'], difficulty: 8 },
    save: 'evasion',
    effect: { kind: 'damage', dice: { count: 1, sides: 6, modifier: 0 } },
  },
  {
    name: 'falling block',
    notice: 8,
    disarm: { skill: 'exert', attributes: ['str'], difficulty: 8 },
    save: 'evasion',
    effect: { kind: 'damage', dice: { count: 1, sides: 8, modifier: 0 } },
  },
  {
    name: 'poison needle',
    notice: 9,
    disarm: { skill: 'sneak', attributes: ['dex'], difficulty: 9 },
    save: 'physical',
    effect: { kind: 'poison' },
  },
  {
    name: 'alarm wire',
    notice: 8,
    disarm: { skill: 'sneak', attributes: ['dex'], difficulty: 7 },
    save: null,
    effect: { kind: 'alarm' },
  },
];

export function neighbors(c: Cell, w: number, h: number): [Facing, Cell][] {
  return SIDES.map(([f, dx, dy]): [Facing, Cell] => [f, { x: c.x + dx, y: c.y + dy }]).filter(
    ([, n]) => n.x >= 0 && n.y >= 0 && n.x < w && n.y < h,
  );
}

/** A spanning maze from a random cell, so every cell is reachable. */
export function maze(rng: Rng, w: number, h: number): Edges {
  const edges: Edges = new Map();
  const seen = new Set<string>();
  const start = { x: rng.int(0, w - 1), y: rng.int(0, h - 1) };
  const stack: Cell[] = [start];
  seen.add(`${start.x},${start.y}`);
  while (stack.length > 0) {
    const c = stack[stack.length - 1] as Cell;
    const open = neighbors(c, w, h).filter(([, n]) => !seen.has(`${n.x},${n.y}`));
    if (open.length === 0) {
      stack.pop();
      continue;
    }
    const [, n] = open[rng.int(0, open.length - 1)] as [Facing, Cell];
    edges.set(pair(c, n), ' ');
    seen.add(`${n.x},${n.y}`);
    stack.push(n);
  }
  return edges;
}

/** Opens a few rooms and loops, turns some passages into doors, and hides one secret door. */
export function decorate(rng: Rng, edges: Edges, w: number, h: number): void {
  for (let r = rng.int(1, 3); r > 0; r--) {
    const rw = rng.int(2, 3);
    const rh = rng.int(2, 3);
    const x0 = rng.int(0, w - rw);
    const y0 = rng.int(0, h - rh);
    for (let y = y0; y < y0 + rh; y++)
      for (let x = x0; x < x0 + rw; x++) {
        if (x + 1 < x0 + rw) edges.set(pair({ x, y }, { x: x + 1, y }), ' ');
        if (y + 1 < y0 + rh) edges.set(pair({ x, y }, { x, y: y + 1 }), ' ');
      }
  }
  const walls: [Cell, Cell][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++)
      for (const [f, n] of neighbors({ x, y }, w, h))
        if ((f === 'e' || f === 's') && !edges.has(pair({ x, y }, n))) walls.push([{ x, y }, n]);
  // At 8 x 8 cells or more, a maze leaves far more walls than loops or the secret door need.
  for (let loops = Math.floor((w * h) / 12); loops > 0; loops--) {
    const [a, b] = walls.splice(rng.int(0, walls.length - 1), 1)[0] as [Cell, Cell];
    edges.set(pair(a, b), rng.int(1, 4) === 1 ? 'd' : ' ');
  }
  const [a, b] = walls[rng.int(0, walls.length - 1)] as [Cell, Cell];
  edges.set(pair(a, b), 's');
}

/** Cells by distance from `from` along open passages and doors. */
export function distances(edges: Edges, w: number, h: number, from: Cell): Map<string, number> {
  const dist = new Map([[`${from.x},${from.y}`, 0]]);
  const queue = [from];
  while (queue.length > 0) {
    const c = queue.shift() as Cell;
    for (const [, n] of neighbors(c, w, h)) {
      const e = edges.get(pair(c, n));
      if (e === undefined || e === 's' || dist.has(`${n.x},${n.y}`)) continue;
      dist.set(`${n.x},${n.y}`, (dist.get(`${c.x},${c.y}`) as number) + 1);
      queue.push(n);
    }
  }
  return dist;
}

export function render(edges: Edges, w: number, h: number, glyphs: Map<string, string>): string[] {
  const rows: string[][] = [];
  for (let r = 0; r <= 2 * h; r++)
    rows.push(
      Array.from({ length: 2 * w + 1 }, (_, c) =>
        r % 2 === 0 ? (c % 2 === 0 ? '+' : '-') : c % 2 === 0 ? '|' : ' ',
      ),
    );
  for (const [key, glyph] of edges) {
    const [a, b] = key.split('|').map((p) => p.split(',').map(Number)) as [number[], number[]];
    const row = (a[1] as number) + (b[1] as number) + 1;
    const col = (a[0] as number) + (b[0] as number) + 1;
    (rows[row] as string[])[col] = glyph;
  }
  for (const [key, glyph] of glyphs) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    (rows[2 * y + 1] as string[])[2 * x + 1] = glyph;
  }
  return rows.map((r) => r.join(''));
}

export const cellKey = (c: Cell) => `${c.x},${c.y}`;

export function cellOf(key: string): Cell {
  const [x, y] = key.split(',').map(Number) as [number, number];
  return { x, y };
}

/** Removes and returns a random cell key from `free`. */
export function takeCell(rng: Rng, free: string[]): Cell {
  return cellOf(free.splice(rng.int(0, free.length - 1), 1)[0] as string);
}

/** A facing from `c` with an open edge or door, for arriving on stairs. */
export function openFacing(edges: Edges, c: Cell, w: number, h: number): Facing {
  return (neighbors(c, w, h).find(([, n]) => edges.has(pair(c, n))) as [Facing, Cell])[0];
}

/** A random trap at `at`, a point harder to notice for each level down (`index`). */
export function trapAt(rng: Rng, at: Cell, index: number): Trap {
  const kind = TRAPS[rng.int(0, TRAPS.length - 1)] as Omit<Trap, 'at'>;
  return { ...kind, notice: kind.notice + index, at };
}

export const cacheAt = (ruin: Ruin, at: Cell): DungeonLevel['specials'][number] => ({
  kind: 'cache',
  at,
  loot: ruin.cache,
});

export const vaultAt = (ruin: Ruin, at: Cell): DungeonLevel['specials'][number] => ({
  kind: 'cache',
  at,
  loot: ruin.vault.loot,
  guards: ruin.vault.guards,
  vault: true,
  ...(ruin.vault.component ? { component: ruin.vault.component } : {}),
});

/** A generated level with no links yet. */
export function emptyLevel(
  ruin: Ruin,
  id: string,
  name: string,
  map: string[],
  safe: Cell,
): DungeonLevel {
  return {
    id,
    name,
    map,
    links: [],
    wander: { ...ruin.wander },
    safe: [safe],
    secrets: [],
    traps: [],
    specials: [],
    captives: [],
    garrisons: [],
  };
}
