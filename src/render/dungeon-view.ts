// Read-only drawing data for the first-person dungeon view (docs/plan.md, Phase 7; Sam's call:
// flat-shaded panels, with procedural stone and wood in docs/presentation-plan.md, V1). Cells up to
// four deep, painted far to near so nearer walls and doors hide what is behind them. Secret doors
// look like walls until found, and traps show once known.
import type { EdgeKind, LevelMap } from '../data/dungeon-map.ts';
import type { Trap } from '../data/schemas/index.ts';
import { levelOf } from '../game/dungeon/explore.ts';
import { blind } from '../game/dungeon/light.ts';
import { edgeKey, knownEdges } from '../game/dungeon/secrets.ts';
import type { GameData } from '../game/character/context.ts';
import type { World } from '../game/world/types.ts';
import { ahead, cellKey, turn, type Cell, type Facing } from '../rules/grid.ts';
import {
  beams,
  breach,
  flagstones,
  inset,
  planks,
  stonework,
  treads,
  type Breach,
  type Detail,
  type Quad,
} from './dungeon-detail.ts';
import {
  alongFlat,
  alongSide,
  flat,
  flatOn,
  fmt,
  front,
  sideWall,
  upright,
  type Span,
} from './dungeon-geometry.ts';
import { PLATE, trapArt, type TrapArt, type TrapEffect, type TrapLook } from './trap-art.ts';

export { VIEW_DEPTH, VIEW_HEIGHT, VIEW_WIDTH } from './dungeon-geometry.ts';
import { VIEW_DEPTH } from './dungeon-geometry.ts';

export interface Panel {
  key: string;
  kind: 'wall' | 'door' | 'dug' | 'up' | 'down' | 'trap' | 'floor' | 'ceiling';
  /** SVG polygon points. */
  points: string;
  /** A door's leaf inside the panel, or null. */
  frame: string | null;
  fill: string;
  /** Stone, flagstones, or treads drawn over the panel. */
  detail: Detail;
  /** The hole torn through a dug wall, for a wall opened by magic. */
  breach: Breach | null;
  /** A known trap's plate, chalk, and marks, for a trap. */
  trap: TrapArt | null;
  /** The door leaf's fill and planks, for a door. */
  leaf: { fill: string; detail: Detail } | null;
  /**
   * How far the panel runs from the party, in view planes (0 is the party's own cell edge), and
   * the midpoints of its near and far edges, so the light can fade along it.
   */
  span: Span;
}

/**
 * Surface shading: side walls darker than walls faced head on, and a gentle step darker with
 * distance. The light's falloff (dungeon-light.ts) does the rest, so this never reaches black.
 */
export function shade(kind: Panel['kind'], depth: number, side: boolean): string {
  const light = Math.max(20, (side ? 48 : 58) - depth * 5);
  if (kind === 'trap') return `hsl(34 12% ${light - 16}%)`;
  if (kind === 'door') return `hsl(26 38% ${light - 18}%)`;
  if (kind === 'wall') return `hsl(32 10% ${light}%)`;
  if (kind === 'floor') return `hsl(30 14% ${light - 20}%)`;
  if (kind === 'ceiling') return `hsl(220 6% ${light - 32}%)`;
  return `hsl(42 30% ${light - 14}%)`;
}

/** The cell `depth` ahead and `lateral` to the right (negative: left) of the party. */
function cellAt(at: Cell, f: Facing, depth: number, lateral: number): Cell {
  return ahead(ahead(at, f, depth), turn(f, 'right'), lateral);
}

/**
 * A wall, door, or dug-through wall on the `side` edge of cell `c`. Its stones are keyed by the
 * cell and side, so they stay put between visits; a hole by the edge, so both sides match.
 */
function panel(
  key: string,
  kind: 'wall' | 'door' | 'dug',
  q: Quad,
  depth: number,
  along: boolean,
  c: Cell,
  side: Facing,
): Panel {
  const leaf = inset(q, 0.25, 0.75, 0.2, 1);
  return {
    key,
    kind,
    points: fmt(q),
    frame: kind === 'door' ? fmt(leaf) : null,
    // A door is a wooden leaf set in a stone wall.
    fill: shade('wall', depth, along),
    detail: stonework(q, `${cellKey(c)}:${side}`),
    breach: kind === 'dug' ? breach(q, edgeKey(c, side)) : null,
    trap: null,
    leaf: kind === 'door' ? { fill: shade('door', depth, along), detail: planks(leaf) } : null,
    span: along ? alongSide(depth, q) : flatOn(depth + 1, q),
  };
}

/** The floor and ceiling squares of a cell, flagged and shaded by distance. */
function flats(depth: number, lateral: number, c: Cell): Panel[] {
  const floor = flat(depth, lateral, false);
  const ceiling = flat(depth, lateral, true);
  return [
    {
      key: `floor-${depth}-${lateral}`,
      kind: 'floor',
      points: fmt(floor),
      frame: null,
      fill: shade('floor', depth, false),
      detail: flagstones(floor, cellKey(c)),
      breach: null,
      trap: null,
      leaf: null,
      span: alongFlat(depth, floor),
    },
    {
      key: `ceiling-${depth}-${lateral}`,
      kind: 'ceiling',
      points: fmt(ceiling),
      frame: null,
      fill: shade('ceiling', depth, false),
      detail: beams(ceiling),
      breach: null,
      trap: null,
      leaf: null,
      span: alongFlat(depth, ceiling),
    },
  ];
}

/** A known trap: its plate as the panel, with its chalk and marks. */
function trapPanel(depth: number, lateral: number, c: Cell, look: TrapLook): Panel {
  const floor = flat(depth, lateral, false);
  const plate = inset(floor, PLATE[0], PLATE[1], PLATE[0], PLATE[1]);
  return {
    key: `trap-${depth}-${lateral}`,
    kind: 'trap',
    points: fmt(plate),
    frame: null,
    fill: shade('trap', depth, false),
    detail: { lines: '', patches: '' },
    breach: null,
    trap: trapArt(floor, upright(depth + 0.5, lateral), cellKey(c), look),
    leaf: null,
    span: flatOn(depth + 0.5, plate),
  };
}

/** An edge as the view draws it: as the map has it, or a wall the party dug through. */
type ViewEdge = EdgeKind | 'dug';

/** Everything in view from the party's cell, in drawing order. */
export function dungeonView(w: World, data: GameData): Panel[] {
  const s = w.dungeon;
  // In the dark there is nothing to see (docs/rules-adaptation.md, Dungeon exploration).
  if (!s || blind(w, data)) return [];
  const { level, map } = levelOf(data, s.dungeon, s.level);
  // A trap shows once the party has noticed it, and stays in view once disarmed.
  const trapLook = (c: Cell): TrapLook | null => {
    const known = s.traps[s.level]?.[cellKey(c)];
    if (!known) return null;
    return { effect: effectAt(level.traps, c), disarmed: known === 'disarmed' };
  };
  // A wall dug through by magic shows its hole rather than vanishing.
  const known = knownEdges(w, data);
  const dug = new Set(s.dug[s.level] ?? []);
  const edge = (c: Cell, side: Facing): ViewEdge =>
    dug.has(edgeKey(c, side)) ? 'dug' : known(c, side);
  return viewPanels(map, s.at, s.facing, edge, trapLook);
}

/** What the trap on a cell does; a T square with no trap written for it hurts. */
function effectAt(traps: readonly Trap[], c: Cell): TrapEffect {
  return traps.find((t) => t.at.x === c.x && t.at.y === c.y)?.effect.kind ?? 'damage';
}

/** The level editor's test walk: every secret door shows as a door, and every trap, armed. */
export function sandboxView(
  map: LevelMap,
  at: Cell,
  facing: Facing,
  traps: readonly Trap[] = [],
): Panel[] {
  const edge = (c: Cell, side: Facing): EdgeKind => {
    const e = map.edge(c, side);
    return e === 'secret' ? 'door' : e;
  };
  return viewPanels(map, at, facing, edge, (c) => ({
    effect: effectAt(traps, c),
    disarmed: false,
  }));
}

/** The panels seen from a cell, given which edges look like what and which traps show. */
function viewPanels(
  map: LevelMap,
  at: Cell,
  facing: Facing,
  edge: (c: Cell, side: Facing) => ViewEdge,
  trapLook: (c: Cell) => TrapLook | null,
): Panel[] {
  const left = turn(facing, 'left');
  const right = turn(facing, 'right');
  const kindOf = (c: Cell, side: Facing) => {
    const e = edge(c, side);
    return e === 'open' ? null : e === 'door' || e === 'dug' ? e : 'wall';
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
    for (const { lateral, c } of cells) panels.push(...flats(depth, lateral, c));
    for (const { lateral, c } of cells) {
      const cell = map.cell(c);
      const look = cell === 'trap' ? trapLook(c) : null;
      if (look) panels.push(trapPanel(depth, lateral, c, look));
      if (cell !== 'up' && cell !== 'down') continue;
      const q = inset(flat(depth, lateral, cell === 'up'), 0.2, 0.8, 0.2, 0.8);
      panels.push({
        key: `${cell}-${depth}-${lateral}`,
        kind: cell,
        points: fmt(q),
        frame: null,
        fill: shade(cell, depth, false),
        detail: treads(q),
        breach: null,
        trap: null,
        leaf: null,
        span: flatOn(depth + 0.5, q),
      });
    }
    for (const { lateral, c } of cells) {
      const kind = kindOf(c, facing);
      if (kind)
        panels.push(
          panel(`front-${depth}-${lateral}`, kind, front(depth, lateral), depth, false, c, facing),
        );
    }
    for (const { lateral, c } of cells) {
      const l = lateral <= 0 ? kindOf(c, left) : null;
      if (l)
        panels.push(
          panel(
            `left-${depth}-${lateral}`,
            l,
            sideWall(depth, 2 * lateral - 1),
            depth,
            true,
            c,
            left,
          ),
        );
      const r = lateral >= 0 ? kindOf(c, right) : null;
      if (r)
        panels.push(
          panel(
            `right-${depth}-${lateral}`,
            r,
            sideWall(depth, 2 * lateral + 1),
            depth,
            true,
            c,
            right,
          ),
        );
    }
  }
  return panels;
}
