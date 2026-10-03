// The doubled ASCII level format (docs/plan.md, Map format; docs/decisions/0003-level-authoring.md).
// Row 2y+1, column 2x+1 holds cell (x, y); the characters between cells are its edges, and the
// characters between edges are corners.
import type { Cell, Facing } from './schemas/index.ts';

export type EdgeKind = 'wall' | 'open' | 'door' | 'secret';
export type CellKind = 'floor' | 'up' | 'down' | 'trap' | 'npc';

const EDGES: Record<string, EdgeKind> = { ' ': 'open', d: 'door', s: 'secret' };
const H_WALL = '-';
const V_WALL = '|';
const CORNER = '+';
const CELLS: Record<string, CellKind> = {
  ' ': 'floor',
  '.': 'floor',
  '<': 'up',
  '>': 'down',
  T: 'trap',
  N: 'npc',
};

export interface LevelMap {
  width: number;
  height: number;
  inBounds: (c: Cell) => boolean;
  /** The cell's kind; out of bounds is an error. */
  cell: (c: Cell) => CellKind;
  /** The edge on a cell's side; the outer border is always a wall. */
  edge: (c: Cell, side: Facing) => EdgeKind;
}

/** The text position of a cell's edge on one side. */
function edgeAt(c: Cell, side: Facing): [number, number] {
  const row = 2 * c.y + 1;
  const col = 2 * c.x + 1;
  if (side === 'n') return [row - 1, col];
  if (side === 's') return [row + 1, col];
  if (side === 'w') return [row, col - 1];
  return [row, col + 1];
}

export type LevelParse = { ok: true; map: LevelMap } | { ok: false; errors: string[] };

export function parseLevelMap(rows: readonly string[]): LevelParse {
  const errors: string[] = [];
  const cols = rows[0]?.length ?? 0;
  if (rows.length % 2 === 0 || cols % 2 === 0 || cols < 3)
    errors.push('the grid needs an odd number of rows and columns, at least 3 each');
  rows.forEach((r, i) => {
    if (r.length !== cols) errors.push(`row ${i} is ${r.length} wide, not ${cols}`);
  });
  if (errors.length > 0) return { ok: false, errors };
  const at = (row: number, col: number) => (rows[row] as string)[col] as string;
  for (let row = 0; row < rows.length; row++) {
    for (let col = 0; col < cols; col++) {
      const ch = at(row, col);
      const where = `row ${row}, column ${col}`;
      const border = row === 0 || col === 0 || row === rows.length - 1 || col === cols - 1;
      if (row % 2 === 0 && col % 2 === 0) {
        if (ch !== CORNER) errors.push(`${where}: corners are ${CORNER}`);
      } else if (row % 2 === 1 && col % 2 === 1) {
        if (!(ch in CELLS)) errors.push(`${where}: unknown cell glyph ${ch}`);
      } else {
        const wall = row % 2 === 0 ? H_WALL : V_WALL;
        if (border && ch !== wall) errors.push(`${where}: the outer edge must be a wall`);
        else if (ch !== wall && !(ch in EDGES)) errors.push(`${where}: unknown edge glyph ${ch}`);
      }
    }
  }
  if (errors.length > 0) return { ok: false, errors };
  const width = (cols - 1) / 2;
  const height = (rows.length - 1) / 2;
  const inBounds = (c: Cell) => c.x >= 0 && c.y >= 0 && c.x < width && c.y < height;
  return {
    ok: true,
    map: {
      width,
      height,
      inBounds,
      cell: (c) => {
        if (!inBounds(c)) throw new Error(`cell ${c.x},${c.y} is off the level`);
        return CELLS[at(2 * c.y + 1, 2 * c.x + 1)] as CellKind;
      },
      edge: (c, side) => {
        if (!inBounds(c)) throw new Error(`cell ${c.x},${c.y} is off the level`);
        const [row, col] = edgeAt(c, side);
        return EDGES[at(row, col)] ?? 'wall';
      },
    },
  };
}
