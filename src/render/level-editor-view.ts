// Drawing data for the level editor's grid (docs/decisions/0003-level-authoring.md). Pure.
import { parseLevelMap, type CellKind, type EdgeKind } from '../data/dungeon-map.ts';
import type { Facing } from '../rules/grid.ts';

export const EDIT_CELL = 28;

export interface GridCell {
  x: number;
  y: number;
  kind: CellKind;
}

export interface GridEdge {
  key: string;
  /** The cell the edge is named from, and its side. */
  x: number;
  y: number;
  side: Facing;
  kind: EdgeKind;
  /** The outer border, which can't change. */
  border: boolean;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
}

export interface EditorGrid {
  width: number;
  height: number;
  cells: GridCell[];
  edges: GridEdge[];
}

/** Every cell, and every edge once (north and west sides, plus the south and east borders). */
export function editorGrid(rows: readonly string[]): EditorGrid | null {
  const parsed = parseLevelMap(rows);
  if (!parsed.ok) return null;
  const { map } = parsed;
  const cells: GridCell[] = [];
  const edges: GridEdge[] = [];
  const E = EDIT_CELL;
  const edge = (x: number, y: number, side: Facing, border: boolean) => {
    const [x1, y1, x2, y2] = {
      n: [x * E, y * E, (x + 1) * E, y * E],
      s: [x * E, (y + 1) * E, (x + 1) * E, (y + 1) * E],
      w: [x * E, y * E, x * E, (y + 1) * E],
      e: [(x + 1) * E, y * E, (x + 1) * E, (y + 1) * E],
    }[side] as [number, number, number, number];
    edges.push({
      key: `${x},${y},${side}`,
      x,
      y,
      side,
      kind: map.edge({ x, y }, side),
      border,
      x1,
      y1,
      x2,
      y2,
    });
  };
  for (let y = 0; y < map.height; y++)
    for (let x = 0; x < map.width; x++) {
      cells.push({ x, y, kind: map.cell({ x, y }) });
      edge(x, y, 'n', y === 0);
      edge(x, y, 'w', x === 0);
      if (y === map.height - 1) edge(x, y, 's', true);
      if (x === map.width - 1) edge(x, y, 'e', true);
    }
  return { width: map.width * E, height: map.height * E, cells, edges };
}
