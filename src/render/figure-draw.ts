// A fight slot's figure as drawing data: its parts and its transform (docs/presentation-plan.md,
// V3). Ties the figure chosen in figure-view.ts to the art in figure-art.ts and monster-art.ts.
import { figureTransform, personParts, type Part } from './figure-art.ts';
import type { FigureView } from './figure-view.ts';
import { monsterParts, UPRIGHT } from './monster-art.ts';

/**
 * How far, in the figure's 48-unit box, its body is shifted against itself to find its lit and
 * shaded edges (V7): light falls from the upper left, so the upper-left rim is lit and the
 * lower-right edge is in shade.
 */
export const RELIEF = 1.6;

export interface FigureDrawing {
  parts: Part[];
  transform: string;
  /** The shift for the lit rim (and, negated, the shaded edge); none for a figure that is down. */
  relief: number | null;
}

export function drawFigure(v: FigureView, down: boolean): FigureDrawing {
  const parts = v.kind === 'person' ? personParts(v) : monsterParts(v.shape);
  const upright = v.kind === 'person' || UPRIGHT.has(v.shape);
  // A fallen figure lies flat in its own shadow.
  return { parts, transform: figureTransform(v, down, upright), relief: down ? null : RELIEF };
}
