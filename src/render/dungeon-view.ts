// Read-only drawing data for the first-person dungeon view (docs/plan.md, Phase 7; Sam's call:
// flat-shaded panels). Cells up to four deep, painted far to near so nearer walls and doors hide
// what is behind them. Secret doors look like walls until found, and traps show once known.
import type { EdgeKind, LevelMap } from '../data/dungeon-map.ts';
import { levelOf } from '../game/dungeon/explore.ts';
import { inDark } from '../game/dungeon/light.ts';
import { knownEdges } from '../game/dungeon/secrets.ts';
import type { GameData } from '../game/character/context.ts';
import type { World } from '../game/world/types.ts';
import { ahead, cellKey, turn, type Cell, type Facing } from '../rules/grid.ts';

export const VIEW_WIDTH = 320;
export const VIEW_HEIGHT = 240;
export const VIEW_DEPTH = 4;

export interface Panel {
  key: string;
  kind: 'wall' | 'door' | 'up' | 'down' | 'trap';
  /** SVG polygon points. */
  points: string;
  /** A door's frame inside the panel, or null. */
  frame: string | null;
  fill: string;
}

type Point = [number, number];
type Quad = [Point, Point, Point, Point];

const CX = VIEW_WIDTH / 2;
const CY = VIEW_HEIGHT / 2;
/** Half the width and height of the view plane k cell-lengths ahead of the party. */
const hw = (k: number) => CX / (k + 1);
const hh = (k: number) => CY / (k + 1);

const fmt = (q: readonly Point[]) => q.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
const mix = (a: Point, b: Point, t: number): Point => [
  a[0] + (b[0] - a[0]) * t,
  a[1] + (b[1] - a[1]) * t,
];
/** A point inside a quad (top-left, top-right, bottom-right, bottom-left) by its fractions. */
const inQuad = (q: Quad, u: number, v: number) => mix(mix(q[0], q[1], u), mix(q[3], q[2], u), v);
const inset = (q: Quad, u0: number, u1: number, v0: number, v1: number): Quad => [
  inQuad(q, u0, v0),
  inQuad(q, u1, v0),
  inQuad(q, u1, v1),
  inQuad(q, u0, v1),
];

/** Distance shading: lighter near, darker far, side walls darker than walls faced head on. */
export function shade(kind: Panel['kind'], depth: number, side: boolean): string {
  const light = Math.max(8, (side ? 46 : 60) - depth * 11);
  if (kind === 'trap') return `hsl(2 60% ${light - 12}%)`;
  if (kind === 'door') return `hsl(28 42% ${light - 8}%)`;
  if (kind === 'wall') return `hsl(32 10% ${light}%)`;
  return `hsl(42 30% ${light - 14}%)`;
}

/** The cell `depth` ahead and `lateral` to the right (negative: left) of the party. */
function cellAt(at: Cell, f: Facing, depth: number, lateral: number): Cell {
  return ahead(ahead(at, f, depth), turn(f, 'right'), lateral);
}

/** The x of the line `lateral` cells right of centre, in half cells, on plane k. */
const xAt = (halfCells: number, k: number) => CX + halfCells * hw(k);

function front(depth: number, lateral: number): Quad {
  const k = depth + 1;
  const [l, r] = [xAt(2 * lateral - 1, k), xAt(2 * lateral + 1, k)];
  return [
    [l, CY - hh(k)],
    [r, CY - hh(k)],
    [r, CY + hh(k)],
    [l, CY + hh(k)],
  ];
}

/** A side wall from the near plane to the far one, near edge first. */
function sideWall(depth: number, halfCells: number): Quad {
  const [near, far] = [depth, depth + 1];
  return [
    [xAt(halfCells, near), CY - hh(near)],
    [xAt(halfCells, far), CY - hh(far)],
    [xAt(halfCells, far), CY + hh(far)],
    [xAt(halfCells, near), CY + hh(near)],
  ];
}

/** The floor (or ceiling) square of a cell, near edge at the bottom of the quad's order. */
function flat(depth: number, lateral: number, ceiling: boolean): Quad {
  const [near, far] = [depth, depth + 1];
  const y = (k: number) => (ceiling ? CY - hh(k) : CY + hh(k));
  return [
    [xAt(2 * lateral - 1, far), y(far)],
    [xAt(2 * lateral + 1, far), y(far)],
    [xAt(2 * lateral + 1, near), y(near)],
    [xAt(2 * lateral - 1, near), y(near)],
  ];
}

function panel(key: string, kind: 'wall' | 'door', q: Quad, depth: number, side: boolean): Panel {
  return {
    key,
    kind,
    points: fmt(q),
    frame: kind === 'door' ? fmt(inset(q, 0.25, 0.75, 0.2, 1)) : null,
    fill: shade(kind, depth, side),
  };
}

/** Everything in view from the party's cell, in drawing order. */
export function dungeonView(w: World, data: GameData): Panel[] {
  const s = w.dungeon;
  // In the dark there is nothing to see (docs/rules-adaptation.md, Dungeon exploration).
  if (!s || inDark(w, data)) return [];
  const { map } = levelOf(data, s.dungeon, s.level);
  const trapKnown = (c: Cell) => s.traps[s.level]?.[cellKey(c)] === 'noticed';
  return viewPanels(map, s.at, s.facing, knownEdges(w, data), trapKnown);
}

/** The level editor's test walk: every secret door shows as a door, and every trap. */
export function sandboxView(map: LevelMap, at: Cell, facing: Facing): Panel[] {
  const edge = (c: Cell, side: Facing): EdgeKind => {
    const e = map.edge(c, side);
    return e === 'secret' ? 'door' : e;
  };
  return viewPanels(map, at, facing, edge, () => true);
}

/** The panels seen from a cell, given which edges look like what and which traps show. */
function viewPanels(
  map: LevelMap,
  at: Cell,
  facing: Facing,
  edge: (c: Cell, side: Facing) => EdgeKind,
  trapKnown: (c: Cell) => boolean,
): Panel[] {
  const left = turn(facing, 'left');
  const right = turn(facing, 'right');
  const kindOf = (c: Cell, side: Facing) => {
    const e = edge(c, side);
    return e === 'open' ? null : e === 'door' ? 'door' : 'wall';
  };
  const panels: Panel[] = [];
  for (let depth = VIEW_DEPTH - 1; depth >= 0; depth--) {
    // Outer cells first, so the walls nearer the centre line paint over them.
    const reach = Math.min(depth + 1, 3);
    const laterals: number[] = [];
    for (let l = reach; l > 0; l--) laterals.push(-l, l);
    laterals.push(0);
    const cells = laterals
      .map((lateral) => ({ lateral, c: cellAt(at, facing, depth, lateral) }))
      .filter(({ c }) => map.inBounds(c));
    for (const { lateral, c } of cells) {
      // A trap shows once the party knows of it.
      const cell = map.cell(c);
      const k = cell === 'trap' && !trapKnown(c) ? 'floor' : cell;
      if (k !== 'up' && k !== 'down' && k !== 'trap') continue;
      const q = inset(flat(depth, lateral, k === 'up'), 0.2, 0.8, 0.2, 0.8);
      panels.push({
        key: `${k}-${depth}-${lateral}`,
        kind: k,
        points: fmt(q),
        frame: null,
        fill: shade(k, depth, false),
      });
    }
    for (const { lateral, c } of cells) {
      const kind = kindOf(c, facing);
      if (kind)
        panels.push(panel(`front-${depth}-${lateral}`, kind, front(depth, lateral), depth, false));
    }
    for (const { lateral, c } of cells) {
      const l = lateral <= 0 ? kindOf(c, left) : null;
      if (l)
        panels.push(
          panel(`left-${depth}-${lateral}`, l, sideWall(depth, 2 * lateral - 1), depth, true),
        );
      const r = lateral >= 0 ? kindOf(c, right) : null;
      if (r)
        panels.push(
          panel(`right-${depth}-${lateral}`, r, sideWall(depth, 2 * lateral + 1), depth, true),
        );
    }
  }
  return panels;
}
