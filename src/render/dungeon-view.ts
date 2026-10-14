// Read-only drawing data for the first-person dungeon view (docs/plan.md, Phase 7; Sam's call:
// flat-shaded panels, with procedural stone and wood in docs/presentation-plan.md, V1). Cells up to
// four deep, painted far to near so nearer walls and doors hide what is behind them. Secret doors
// look like walls until found, and traps show once known.
import type { EdgeKind, LevelMap } from '../data/dungeon-map.ts';
import type { Trap } from '../data/schemas/index.ts';
import { levelOf } from '../game/dungeon/explore.ts';
import { arcaneSeer, blind } from '../game/dungeon/light.ts';
import { seer } from '../game/world/arts.ts';
import { darknessPanels, type DarkAt } from './dungeon-darkness.ts';
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
} from './dungeon-geometry.ts';
import { PLATE, trapArt, type TrapEffect, type TrapLook } from './trap-art.ts';
import type { Furniture } from '../data/schemas/index.ts';
import { furnitureOf, furniturePanel, type FurnitureAt } from './dungeon-furniture.ts';
import { shade, type Panel } from './dungeon-panel.ts';

export { shade, type Panel } from './dungeon-panel.ts';

export { VIEW_DEPTH, VIEW_HEIGHT, VIEW_WIDTH } from './dungeon-geometry.ts';
import { VIEW_DEPTH } from './dungeon-geometry.ts';

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
  // Those who see without light see into magical darkness too, as they do standing in it.
  const seeing = seer(w, data) || arcaneSeer(w);
  const darkAt: DarkAt = (c) =>
    !seeing &&
    level.specials.some((x) => x.kind === 'darkness' && x.at.x === c.x && x.at.y === c.y);
  return viewPanels(map, s.at, s.facing, edge, trapLook, furnitureOf(level.furniture), darkAt);
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
  furniture: readonly Furniture[] = [],
): Panel[] {
  const edge = (c: Cell, side: Facing): EdgeKind => {
    const e = map.edge(c, side);
    return e === 'secret' ? 'door' : e;
  };
  return viewPanels(
    map,
    at,
    facing,
    edge,
    (c) => ({ effect: effectAt(traps, c), disarmed: false }),
    furnitureOf(furniture),
  );
}

/** The panels seen from a cell, given which edges look like what and which traps show. */
function viewPanels(
  map: LevelMap,
  at: Cell,
  facing: Facing,
  edge: (c: Cell, side: Facing) => ViewEdge,
  trapLook: (c: Cell) => TrapLook | null,
  furnitureAt: FurnitureAt,
  darkAt: DarkAt = () => false,
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
    // Furniture stands mid-cell: in front of the cell's far wall, behind nearer side walls. What
    // stands in the party's own cell is underfoot, out of the view.
    for (const { lateral, c } of depth > 0 ? cells : []) {
      const kind = furnitureAt(c);
      if (kind) panels.push(furniturePanel(kind, depth, lateral));
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
    // Magical darkness hides its cell and what lies beyond it, drawn over both.
    for (const { lateral, c } of depth > 0 ? cells : [])
      if (darkAt(c)) panels.push(...darknessPanels(depth, lateral));
  }
  return panels;
}
