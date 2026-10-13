// Furniture in the first-person view (docs/presentation-plan.md, V4): which piece stands on a cell,
// and its panel, standing mid-cell and shaded like stone.
import type { Furniture } from '../data/schemas/index.ts';
import type { Cell } from '../rules/grid.ts';
import { flatOn } from './dungeon-geometry.ts';
import { shade, type Panel } from './dungeon-panel.ts';
import { furnitureIn } from './furniture-art.ts';

export type FurnitureAt = (c: Cell) => Furniture['kind'] | null;

/** What stands on each cell of a level. */
export const furnitureOf =
  (list: readonly Furniture[] = []): FurnitureAt =>
  (c) =>
    list.find((f) => f.at.x === c.x && f.at.y === c.y)?.kind ?? null;

/** A piece of furniture standing in the middle of its cell, shaded like stone. */
export function furniturePanel(kind: Furniture['kind'], depth: number, lateral: number): Panel {
  const art = furnitureIn(kind, depth, lateral);
  return {
    key: `furniture-${depth}-${lateral}`,
    kind: 'furniture',
    points: '',
    frame: null,
    fill: shade('wall', depth, false),
    detail: { lines: '', patches: '' },
    breach: null,
    trap: null,
    leaf: null,
    furniture: art,
    span: flatOn(depth + 0.5, [
      [art.x, art.y],
      [art.x + art.size, art.y],
      [art.x + art.size, art.y + art.size],
      [art.x, art.y + art.size],
    ]),
  };
}
