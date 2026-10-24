// Ruined cities (docs/rules-adaptation.md, Ruins; Sam's call): a single street level of blocks,
// each a building with a door onto the street or a heap of rubble, and for some cities a sewer
// below, reached by two manholes. The vault is in the largest building, or at the far end of the
// sewer when there is one.
import type { DungeonLevel, Ruin } from '../../data/schemas/index.ts';
import type { Rng } from '../../rules/rng.ts';
import type { Generated } from './generate.ts';
import {
  cacheAt,
  cellKey,
  cellOf,
  decorate,
  distances,
  emptyLevel,
  guardedCaches,
  maze,
  neighbors,
  openFacing,
  pair,
  render,
  takeCell,
  trapAt,
  vaultAt,
  type Cell,
  type Edges,
} from './maze.ts';

/** Street lines every 3 or 4 cells across a span. */
function streetLines(rng: Rng, span: number): Set<number> {
  const lines = new Set<number>();
  for (let at = rng.int(0, 1); at < span; at += rng.int(3, 4)) lines.add(at);
  return lines;
}

/** The blocks between streets: the non-street cells, grouped by flood fill. */
function blocks(w: number, h: number, street: (c: Cell) => boolean): Cell[][] {
  const seen = new Set<string>();
  const out: Cell[][] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (street({ x, y }) || seen.has(cellKey({ x, y }))) continue;
      const block: Cell[] = [];
      const queue = [{ x, y }];
      seen.add(cellKey({ x, y }));
      while (queue.length > 0) {
        const c = queue.shift() as Cell;
        block.push(c);
        for (const [, n] of neighbors(c, w, h))
          if (!street(n) && !seen.has(cellKey(n))) {
            seen.add(cellKey(n));
            queue.push(n);
          }
      }
      out.push(block);
    }
  return out;
}

interface Street {
  level: DungeonLevel;
  edges: Edges;
  w: number;
  h: number;
  streets: string[];
  gate: Cell;
  /** Building cells, by building, with each building's door cell first. */
  buildings: Cell[][];
}

function streetLevel(rng: Rng, ruin: Ruin): Street {
  const w = rng.int(ruin.size.min, ruin.size.max);
  const h = rng.int(ruin.size.min, ruin.size.max);
  const xs = streetLines(rng, w);
  const ys = streetLines(rng, h);
  const street = (c: Cell) => xs.has(c.x) || ys.has(c.y);
  const edges: Edges = new Map();
  const streets: string[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      if (!street({ x, y })) continue;
      streets.push(cellKey({ x, y }));
      for (const [, n] of neighbors({ x, y }, w, h))
        if (street(n)) edges.set(pair({ x, y }, n), ' ');
    }
  const buildings: Cell[][] = [];
  for (const block of blocks(w, h, street)) {
    // One block in five has fallen into rubble, but some buildings always stand.
    if (buildings.length >= 2 && rng.int(1, 5) === 1) continue;
    for (const c of block)
      for (const [, n] of neighbors(c, w, h))
        if (block.some((b) => b.x === n.x && b.y === n.y)) edges.set(pair(c, n), ' ');
    const fronts = block.flatMap((c) =>
      neighbors(c, w, h)
        .filter(([, n]) => street(n))
        .map(([, n]): [Cell, Cell] => [c, n]),
    );
    const [inside, outside] = fronts[rng.int(0, fronts.length - 1)] as [Cell, Cell];
    // Some doors are long gone.
    edges.set(pair(inside, outside), rng.int(1, 4) === 1 ? ' ' : 'd');
    buildings.push([inside, ...block.filter((c) => c !== inside)]);
  }
  const gate = cellOf(streets[rng.int(0, streets.length - 1)] as string);
  const level = emptyLevel(ruin, `${ruin.id}-streets`, `${ruin.name}, the streets`, [], gate);
  return { level, edges, w, h, streets, gate, buildings };
}

function sewerLevel(rng: Rng, ruin: Ruin, w: number, h: number) {
  const edges = maze(rng, w, h);
  decorate(rng, edges, w, h);
  const a = { x: rng.int(0, w - 1), y: rng.int(0, h - 1) };
  const dist = [...distances(edges, w, h, a)].sort((p, q) => q[1] - p[1]);
  // The vault at the far end; the second manhole about halfway along.
  const vault = cellOf((dist[0] as [string, number])[0]);
  const b = cellOf((dist[Math.floor(dist.length / 2)] as [string, number])[0]);
  const free = dist
    .map(([k]) => k)
    .filter((k) => ![cellKey(a), cellKey(b), cellKey(vault)].includes(k));
  const traps = Array.from({ length: 3 }, () => trapAt(rng, takeCell(rng, free), 1));
  const glyphs = new Map([
    [cellKey(a), '<'],
    [cellKey(b), '<'],
    ...traps.map((t): [string, string] => [cellKey(t.at), 'T']),
  ]);
  const level = emptyLevel(
    ruin,
    `${ruin.id}-sewer`,
    `${ruin.name}, the sewer`,
    render(edges, w, h, glyphs),
    a,
  );
  const specials = [
    cacheAt(ruin, takeCell(rng, free)),
    ...guardedCaches(rng, ruin, free),
    vaultAt(ruin, vault),
  ];
  return { level: { ...level, traps, specials }, a, b, edges };
}

/** The largest building's farthest room from its door, for the vault of a city with no sewer. */
function vaultRoom(city: Street): Cell {
  const biggest = city.buildings.reduce((a, b) => (b.length > a.length ? b : a));
  const dist = distances(city.edges, city.w, city.h, biggest[0] as Cell);
  // Every room is reachable from the building's door.
  const far = (c: Cell) => dist.get(cellKey(c)) as number;
  return biggest.reduce((a, b) => (far(b) > far(a) ? b : a));
}

export function generateCity(rng: Rng, ruin: Ruin): Generated {
  const city = streetLevel(rng, ruin);
  const { edges, w, h, gate } = city;
  const vault = ruin.sewer ? null : vaultRoom(city);
  const glyphs = new Map([[cellKey(gate), '<']]);
  const rooms = city.buildings
    .flatMap((b) => b.slice(1))
    .map(cellKey)
    .filter((k) => vault === null || k !== cellKey(vault));
  const traps = Array.from({ length: 3 }, () => trapAt(rng, takeCell(rng, rooms), 0));
  for (const t of traps) glyphs.set(cellKey(t.at), 'T');
  const specials = Array.from({ length: rng.int(2, 3) }, () => cacheAt(ruin, takeCell(rng, rooms)));
  specials.push(...guardedCaches(rng, ruin, rooms));
  if (vault) specials.push(vaultAt(ruin, vault));
  const levels: DungeonLevel[] = [];
  const links: DungeonLevel['links'] = [{ at: gate, to: { surface: true } }];
  if (ruin.sewer) {
    const sewer = sewerLevel(rng, ruin, w, h);
    const holes = city.streets.filter((k) => k !== cellKey(gate));
    const m1 = takeCell(rng, holes);
    const m2 = takeCell(rng, holes);
    glyphs.set(cellKey(m1), '>');
    glyphs.set(cellKey(m2), '>');
    const down = (at: Cell) => ({
      level: sewer.level.id,
      at,
      facing: openFacing(sewer.edges, at, w, h),
    });
    const up = (at: Cell) => ({ level: city.level.id, at, facing: openFacing(edges, at, w, h) });
    links.push({ at: m1, to: down(sewer.a) }, { at: m2, to: down(sewer.b) });
    sewer.level.links.push({ at: sewer.a, to: up(m1) }, { at: sewer.b, to: up(m2) });
    levels.push(sewer.level);
  }
  const street = { ...city.level, map: render(edges, w, h, glyphs), links, traps, specials };
  return { levels: [street, ...levels], facing: openFacing(edges, gate, w, h) };
}
