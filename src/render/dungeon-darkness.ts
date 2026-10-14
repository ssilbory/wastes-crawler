// Squares of magical darkness seen from outside (Sam's ask; docs/rules-adaptation.md, Darkness):
// a block of black the light doesn't enter, hiding what lies beyond it. Its near face covers its
// column; a cell off to the side also shows the face turned toward the middle.
import type { Cell } from '../rules/grid.ts';
import { alongSide, flatOn, fmt, sideWall, upright } from './dungeon-geometry.ts';
import type { Panel } from './dungeon-panel.ts';
import type { Quad } from './dungeon-detail.ts';

export type DarkAt = (c: Cell) => boolean;

/** Pitch black, whatever the light. */
export const DARKNESS = '#030303';

const face = (key: string, q: Quad, span: Panel['span']): Panel => ({
  key,
  kind: 'darkness',
  points: fmt(q),
  frame: null,
  fill: DARKNESS,
  detail: { lines: '', patches: '' },
  breach: null,
  trap: null,
  leaf: null,
  span,
});

/** The faces of a dark cell `depth` ahead and `lateral` across, drawn over all behind them. */
export function darknessPanels(depth: number, lateral: number): Panel[] {
  const near = upright(depth, lateral);
  const panels = [face(`dark-${depth}-${lateral}`, near, flatOn(depth, near))];
  if (lateral !== 0) {
    const side = sideWall(depth, lateral < 0 ? 2 * lateral + 1 : 2 * lateral - 1);
    panels.push(face(`dark-side-${depth}-${lateral}`, side, alongSide(depth, side)));
  }
  return panels;
}
