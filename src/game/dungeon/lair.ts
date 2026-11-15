// Lairs (docs/rules-adaptation.md, Lairs; Sam's calls): a straight run of rooms joined by short
// corridors, from the stairs in the first room to the boss's chamber at the far end. Corridors hold
// the traps, the middle rooms bands of the lair's minions, and the last room the boss over its
// vault (or, above the bottom level, the stairs on). Cells outside the rooms and corridors are
// solid rock.
import type { DungeonLevel, Ruin, RuinTrap } from '../../data/schemas/index.ts';
import type { Rng } from '../../rules/rng.ts';
import {
  cacheAt,
  cellKey,
  emptyLevel,
  pair,
  render,
  trapAt,
  vaultAt,
  type Cell,
  type Edges,
} from './maze.ts';

/** The row every corridor runs along. */
const MID = 2;
/** Rows in a lair level: rooms reach up to two rows either side of the middle. */
const HEIGHT = 5;

interface Room {
  cells: Cell[];
  /** The room's cell on the middle row furthest along. */
  far: Cell;
}

/** Opens every edge between cells of a block. */
function carve(edges: Edges, cells: readonly Cell[]): void {
  const keys = new Set(cells.map(cellKey));
  for (const c of cells)
    for (const n of [
      { x: c.x + 1, y: c.y },
      { x: c.x, y: c.y + 1 },
    ])
      if (keys.has(cellKey(n))) edges.set(pair(c, n), ' ');
}

/** The rooms and corridors: each room's cells, with corridor cells between them. */
function layout(rng: Rng, width: number) {
  const edges: Edges = new Map();
  const rooms: Room[] = [];
  const corridors: Cell[] = [];
  let x = 0;
  while (x < width) {
    const rest = width - x;
    // The last room, the boss's chamber, takes what is left, once a middle room stands before it.
    const last = rest <= 9 && rooms.length >= 2;
    const rw = last ? rest : rng.int(2, 3);
    const ry = last ? 2 : rng.int(1, 2);
    const cells: Cell[] = [];
    for (let cx = x; cx < x + rw; cx++)
      for (let cy = MID - ry; cy <= MID + ry; cy++) cells.push({ x: cx, y: cy });
    carve(edges, cells);
    const room: Room = { cells, far: { x: x + rw - 1, y: MID } };
    if (rooms.length > 0) {
      // The way in from the corridor is a door.
      const before = { x: x - 1, y: MID };
      edges.set(pair(before, { x, y: MID }), 'd');
    }
    rooms.push(room);
    x += rw;
    if (last) break;
    const length = rng.int(1, 3);
    const run: Cell[] = Array.from({ length }, (_, i) => ({ x: x + i, y: MID }));
    edges.set(pair(room.far, run[0] as Cell), ' ');
    carve(edges, run);
    corridors.push(...run);
    x += length;
  }
  return { edges, rooms, corridors };
}

/** One lair level, `index` down: arrive in the first room, and go on from the last. */
export function buildLair(rng: Rng, ruin: Ruin, traps: readonly RuinTrap[], index: number) {
  const width = rng.int(ruin.size.min, ruin.size.max);
  const { edges, rooms, corridors } = layout(rng, width);
  const end = rooms[rooms.length - 1] as Room;
  const arrive = { x: 0, y: MID };
  const onward = end.far;
  const bottom = index === ruin.depth - 1;
  const glyphs = new Map([[cellKey(arrive), '<']]);
  if (!bottom) glyphs.set(cellKey(onward), '>');
  // Traps along the corridors, a step more of them each level down.
  const halls = corridors.map(cellKey);
  const set = Array.from({ length: Math.min(halls.length, index + 2) }, () => {
    const at = halls.splice(rng.int(0, halls.length - 1), 1)[0] as string;
    const [cx, cy] = at.split(',').map(Number) as [number, number];
    return trapAt(rng, traps, { x: cx, y: cy }, index);
  });
  for (const t of set) glyphs.set(cellKey(t.at), 'T');
  // A band of minions in each middle room, and a small cache in one of them.
  const middle = rooms.slice(1, -1);
  // Content checks give every lair its minions.
  const minions = ruin.minions as string[][][];
  const specials: DungeonLevel['specials'] = middle.map((room) => {
    const band = minions[rng.int(0, minions.length - 1)] as string[][];
    return {
      kind: 'guards',
      at: room.far,
      enemies: band,
      text: ruin.minionText ?? 'The lair’s creatures rise to meet the party.',
    };
  });
  // A lair has a middle room or more; the cache sits in a corner, away from the band's doorway.
  const stash = middle[rng.int(0, middle.length - 1)] as Room;
  specials.push(cacheAt(ruin, stash.cells[0] as Cell));
  if (bottom) specials.push(vaultAt(ruin, onward));
  const name = `${ruin.name}, level ${index + 1}`;
  const level = emptyLevel(
    ruin,
    `${ruin.id}-${index + 1}`,
    name,
    render(edges, width, HEIGHT, glyphs),
    arrive,
  );
  return { level: { ...level, traps: set, specials }, arrive, facing: 'e' as const, onward };
}
