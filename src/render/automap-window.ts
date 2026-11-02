// The part of the dungeon automap a phone shows (docs/presentation-plan.md, V4; Sam's call: on a
// phone the map is the main way about). The whole level drawn across a phone's width leaves each
// square too small to tap, so the phone frames what has been seen, a square of margin round it,
// and follows the party once that grows past a dozen squares a side. Presentation only.
import type { Cell } from '../rules/grid.ts';
import { MAP_CELL, type Automap } from './automap-view.ts';

/** The fewest and the most squares a side the window shows, where the level has that many. */
export const WINDOW_LEAST = 7;
export const WINDOW_MOST = 12;

/** A window on the map, in the map's own units (MAP_CELL to a square). */
export interface MapWindow {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Along one side: the first square shown and how many, from the squares seen there (`lo` to `hi`,
 * the party's among them) out of `n` on the level.
 */
function span(lo: number, hi: number, at: number, n: number): [number, number] {
  const [from, to] = [Math.max(0, lo - 1), Math.min(n - 1, hi + 1)];
  const seen = to - from + 1;
  const count = Math.min(n, Math.max(WINDOW_LEAST, Math.min(WINDOW_MOST, seen)));
  // Centred on what was seen while it fits, and on the party once it doesn't; never off the level.
  const start = seen <= count ? from - Math.floor((count - seen) / 2) : at - Math.floor(count / 2);
  return [Math.min(Math.max(0, start), n - count), count];
}

/** The window a phone shows of the automap, framing the seen squares and the party. */
export function automapWindow(
  map: Pick<Automap, 'width' | 'height' | 'cells'>,
  at: Cell,
  size = MAP_CELL,
): MapWindow {
  const xs = [at.x, ...map.cells.map((c) => c.x)];
  const ys = [at.y, ...map.cells.map((c) => c.y)];
  const [x, width] = span(Math.min(...xs), Math.max(...xs), at.x, map.width / size);
  const [y, height] = span(Math.min(...ys), Math.max(...ys), at.y, map.height / size);
  return { x: x * size, y: y * size, width: width * size, height: height * size };
}
