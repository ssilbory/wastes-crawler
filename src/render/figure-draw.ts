// A fight slot's figure as drawing data: its parts and its transform (docs/presentation-plan.md,
// V3). Ties the figure chosen in figure-view.ts to the art in figure-art.ts and monster-art.ts.
import { VIEW_WIDTH } from './dungeon-geometry.ts';
import { figureTransform, personParts, type Part } from './figure-art.ts';
import type { FigureView } from './figure-view.ts';
import { monsterParts, UPRIGHT } from './monster-art.ts';

/**
 * How far, in a piece's 48-unit box, its body is shifted against itself to find its lit and
 * shaded edges (V7). The lit edge is on the side away from the shift.
 */
export const RELIEF = 1.6;

/** A shift as [x, y]: the lit edge faces the other way. */
export type Relief = [number, number];

/** In a fight, light falls from the upper left. */
export const FIGHT_LIGHT: Relief = [RELIEF, RELIEF];

/**
 * In the first-person view the party's light is held up in the middle of the corridor: a piece
 * standing at `cx` (view pixels) is lit on its top and on the side toward the middle, the more so
 * the further aside it stands.
 */
export function lightFrom(cx: number): Relief {
  const aside = Math.max(-1, Math.min(1, (cx - VIEW_WIDTH / 2) / (VIEW_WIDTH / 2)));
  return [Number((aside * RELIEF).toFixed(2)), RELIEF * 0.6];
}

export interface FigureDrawing {
  parts: Part[];
  transform: string;
  /** The shift that finds its lit and shaded edges; none for a figure that is down. */
  relief: Relief | null;
}

export function drawFigure(v: FigureView, down: boolean, light = FIGHT_LIGHT): FigureDrawing {
  const parts = v.kind === 'person' ? personParts(v) : monsterParts(v.shape);
  const upright = v.kind === 'person' || UPRIGHT.has(v.shape);
  // A fallen figure lies flat in its own shadow.
  return { parts, transform: figureTransform(v, down, upright), relief: down ? null : light };
}
