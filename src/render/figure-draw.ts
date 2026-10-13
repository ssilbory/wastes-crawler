// A fight slot's figure as drawing data: its parts and its transform (docs/presentation-plan.md,
// V3). Ties the figure chosen in figure-view.ts to the art in figure-art.ts and monster-art.ts.
import { figureTransform, personParts, type Part } from './figure-art.ts';
import type { FigureView } from './figure-view.ts';
import { monsterParts, UPRIGHT } from './monster-art.ts';

export interface FigureDrawing {
  parts: Part[];
  transform: string;
}

export function drawFigure(v: FigureView, down: boolean): FigureDrawing {
  const parts = v.kind === 'person' ? personParts(v) : monsterParts(v.shape);
  const upright = v.kind === 'person' || UPRIGHT.has(v.shape);
  return { parts, transform: figureTransform(v, down, upright) };
}
