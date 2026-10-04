// Procedural ruins (docs/decisions/0004-procedural-levels.md; docs/rules-adaptation.md, Ruins in
// Phase 12e). A ruin's levels come from its own seed, drawn from the world's RNG, so the same seed
// always gives the same dungeon: a maze with a few loops and rooms in the doubled ASCII format
// (ADR 0003), stairs from each level to the farthest cell of the next, traps that grow denser
// with depth, small loot caches, and a guarded vault at the deepest level's far end.
import type { Dungeon, DungeonLevel, Facing, Ruin, Trap } from '../../data/schemas/index.ts';
import { createRng, type Rng } from '../../rules/rng.ts';

type Cell = { x: number; y: number };
const SIDES: readonly [Facing, number, number][] = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
];
/** The glyph on the edge between two cells, keyed by the pair. */
type Edges = Map<string, ' ' | 'd' | 's'>;
const pair = (a: Cell, b: Cell) =>
  a.y < b.y || (a.y === b.y && a.x < b.x)
    ? `${a.x},${a.y}|${b.x},${b.y}`
    : `${b.x},${b.y}|${a.x},${a.y}`;

const TRAPS: readonly Omit<Trap, 'at'>[] = [
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

function neighbors(c: Cell, w: number, h: number): [Facing, Cell][] {
  return SIDES.map(([f, dx, dy]): [Facing, Cell] => [f, { x: c.x + dx, y: c.y + dy }]).filter(
    ([, n]) => n.x >= 0 && n.y >= 0 && n.x < w && n.y < h,
  );
}

/** A spanning maze from a random cell, so every cell is reachable. */
function maze(rng: Rng, w: number, h: number): Edges {
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
function decorate(rng: Rng, edges: Edges, w: number, h: number): void {
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
function distances(edges: Edges, w: number, h: number, from: Cell): Map<string, number> {
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

function render(edges: Edges, w: number, h: number, glyphs: Map<string, string>): string[] {
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

interface Built {
  level: DungeonLevel;
  up: Cell;
  facing: Facing;
  down: Cell;
}

function buildLevel(rng: Rng, ruin: Ruin, index: number): Built {
  const w = rng.int(ruin.size.min, ruin.size.max);
  const h = rng.int(ruin.size.min, ruin.size.max);
  const edges = maze(rng, w, h);
  decorate(rng, edges, w, h);
  const up = { x: rng.int(0, w - 1), y: rng.int(0, h - 1) };
  const dist = distances(edges, w, h, up);
  const far = [...dist].reduce((a, b) => (b[1] > a[1] ? b : a));
  const [fx, fy] = far[0].split(',').map(Number) as [number, number];
  const down = { x: fx, y: fy };
  const last = index === ruin.depth - 1;
  const glyphs = new Map([[`${up.x},${up.y}`, '<']]);
  if (!last) glyphs.set(`${down.x},${down.y}`, '>');
  // Traps and caches go on cells away from the stairs and the vault.
  const free = [...dist.keys()].filter((k) => k !== `${up.x},${up.y}` && k !== far[0]);
  const take = () => {
    const [x, y] = (free.splice(rng.int(0, free.length - 1), 1)[0] as string)
      .split(',')
      .map(Number);
    return { x: x as number, y: y as number };
  };
  const traps: Trap[] = [];
  for (let t = 0; t < index + 1; t++) {
    const at = take();
    const kind = TRAPS[rng.int(0, TRAPS.length - 1)] as Omit<Trap, 'at'>;
    traps.push({ ...kind, notice: kind.notice + index, at });
    glyphs.set(`${at.x},${at.y}`, 'T');
  }
  const specials: DungeonLevel['specials'] = [];
  for (let n = rng.int(1, 2); n > 0; n--)
    specials.push({ kind: 'cache', at: take(), loot: ruin.cache });
  if (last)
    specials.push({
      kind: 'cache',
      at: down,
      loot: ruin.vault.loot,
      guards: ruin.vault.guards,
      vault: true,
      ...(ruin.vault.component ? { component: ruin.vault.component } : {}),
    });
  const facing = (neighbors(up, w, h).find(([, n]) => edges.has(pair(up, n))) as [Facing, Cell])[0];
  return {
    level: {
      id: `${ruin.id}-${index + 1}`,
      name: `${ruin.name}, level ${index + 1}`,
      map: render(edges, w, h, glyphs),
      links: [],
      wander: { ...ruin.wander },
      safe: [up],
      secrets: [],
      traps,
      specials,
      captives: [],
      garrisons: [],
    },
    up,
    facing,
    down,
  };
}

/** The dungeon id a ruin has under a seed. */
export const ruinDungeonId = (ruin: Ruin, seed: number) => `${ruin.id}-v${seed}`;

/** A ruin's dungeon under a seed: the same seed always gives the same dungeon. */
export function generateRuin(ruin: Ruin, seed: number): Dungeon {
  const rng = createRng(`${ruin.id}:${seed}`);
  const built = Array.from({ length: ruin.depth }, (_, i) => buildLevel(rng, ruin, i));
  built.forEach((b, i) => {
    const next = built[i + 1];
    b.level.links.push({ at: b.up, to: i === 0 ? { surface: true } : link(built[i - 1] as Built) });
    if (next)
      b.level.links.push({
        at: b.down,
        to: { level: next.level.id, at: next.up, facing: next.facing },
      });
  });
  const first = built[0] as Built;
  return {
    id: ruinDungeonId(ruin, seed),
    name: ruin.name,
    region: ruin.region,
    entrance: { col: ruin.col, row: ruin.row },
    entry: { level: first.level.id, at: first.up, facing: first.facing },
    levels: built.map((b) => b.level),
  };
}

/** Climbing back up lands on the level above's stairs down, facing back into it. */
function link(above: Built): { level: string; at: Cell; facing: Facing } {
  return { level: above.level.id, at: above.down, facing: 'n' };
}

/** Generated dungeons by ruin and seed, so a level's parsed map is reused across steps. */
const generated = new WeakMap<Ruin, Map<number, Dungeon>>();

/** The generated dungeon for a ruin dungeon id ("<ruin>-v<seed>"), if the id is one. */
export function ruinDungeon(ruins: readonly Ruin[], id: string): Dungeon | undefined {
  const m = /^(.+)-v(\d+)$/.exec(id);
  const ruin = m && ruins.find((r) => r.id === m[1]);
  if (!m || !ruin) return undefined;
  const seed = Number(m[2]);
  const bySeed = generated.get(ruin) ?? new Map<number, Dungeon>();
  generated.set(ruin, bySeed);
  const d = bySeed.get(seed) ?? generateRuin(ruin, seed);
  bySeed.set(seed, d);
  return d;
}
