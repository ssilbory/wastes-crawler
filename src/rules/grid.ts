// Grid geometry for dungeon levels (docs/plan.md, Map format): cells in rows and columns, facing
// north, east, south, or west; walls sit on the edges between cells. Not from the SRD.

import type { Cell, Facing } from '../data/schemas/index.ts';

export type { Cell, Facing };
export const FACINGS: readonly Facing[] = ['n', 'e', 's', 'w'];

const STEP: Record<Facing, Cell> = {
  n: { x: 0, y: -1 },
  e: { x: 1, y: 0 },
  s: { x: 0, y: 1 },
  w: { x: -1, y: 0 },
};

export const cellKey = (c: Cell) => `${c.x},${c.y}`;

/** A quarter turn left or right, or half a turn. */
export function turn(f: Facing, by: 'left' | 'right' | 'around'): Facing {
  const quarters = by === 'left' ? 3 : by === 'right' ? 1 : 2;
  return FACINGS[(FACINGS.indexOf(f) + quarters) % 4] as Facing;
}

/** The cell `steps` ahead in a facing (negative steps go behind). */
export function ahead(c: Cell, f: Facing, steps = 1): Cell {
  const d = STEP[f];
  return { x: c.x + d.x * steps, y: c.y + d.y * steps };
}

/** The cell to one side of a facing. */
export function beside(c: Cell, f: Facing, side: 'left' | 'right'): Cell {
  return ahead(c, turn(f, side));
}
