import { describe, expect, it } from 'vitest';
import { MAP_CELL, type AutomapCell } from '../../src/render/automap-view.ts';
import { automapWindow, WINDOW_LEAST, WINDOW_MOST } from '../../src/render/automap-window.ts';

/** A level `w` by `h` squares with these squares seen. */
function level(w: number, h: number, seen: [number, number][]) {
  const cells: AutomapCell[] = seen.map(([x, y]) => ({ key: `${x},${y}`, x, y, kind: 'floor' }));
  return { width: w * MAP_CELL, height: h * MAP_CELL, cells };
}

/** A window in squares rather than map units, to read the cases more easily. */
function squares(map: ReturnType<typeof level>, at: { x: number; y: number }) {
  const r = automapWindow(map, at);
  return [r.x, r.y, r.width, r.height].map((n) => n / MAP_CELL);
}

describe('automap window on a phone (docs/presentation-plan.md, V4)', () => {
  it('frames a few squares seen with the least window, centred on them', () => {
    // Seen 5..7 across and 10..11 down; with a square of margin, 4..8 and 9..12.
    const map = level(20, 20, [
      [5, 10],
      [6, 10],
      [7, 11],
    ]);
    expect(squares(map, { x: 6, y: 10 })).toEqual([3, 8, WINDOW_LEAST, WINDOW_LEAST]);
  });

  it('frames everything seen with a square of margin while it fits', () => {
    const map = level(20, 20, [
      [2, 2],
      [11, 9],
    ]);
    // 1..12 across (12 squares) and 1..10 down (10 squares).
    expect(squares(map, { x: 2, y: 2 })).toEqual([1, 1, WINDOW_MOST, 10]);
  });

  it('follows the party once more has been seen than fits', () => {
    const map = level(30, 30, [
      [0, 0],
      [29, 29],
    ]);
    expect(squares(map, { x: 15, y: 15 })).toEqual([9, 9, WINDOW_MOST, WINDOW_MOST]);
  });

  it('keeps the window on the level at its edges', () => {
    const map = level(30, 30, [
      [0, 0],
      [29, 29],
    ]);
    expect(squares(map, { x: 0, y: 29 })).toEqual([0, 30 - WINDOW_MOST, WINDOW_MOST, WINDOW_MOST]);
    // A small window centred near the edge slides back onto the level.
    expect(squares(level(20, 20, [[0, 19]]), { x: 0, y: 19 })).toEqual([
      0,
      20 - WINDOW_LEAST,
      WINDOW_LEAST,
      WINDOW_LEAST,
    ]);
  });

  it('shows a level smaller than the least window whole', () => {
    expect(squares(level(4, 3, [[1, 1]]), { x: 1, y: 1 })).toEqual([0, 0, 4, 3]);
  });

  it('counts the party square when nothing is seen yet', () => {
    expect(squares(level(20, 20, []), { x: 10, y: 10 })).toEqual([
      7,
      7,
      WINDOW_LEAST,
      WINDOW_LEAST,
    ]);
  });
});
