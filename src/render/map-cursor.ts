// The keyboard's place on the overland map and the map editor: a hex the arrow keys move and
// Enter picks, as a click would (src/ui/world/HexMap.tsx). Pure.
import type { Hex } from '../rules/hex.ts';

const STEPS: Record<string, Hex> = {
  ArrowUp: { col: 0, row: -1 },
  ArrowDown: { col: 0, row: 1 },
  ArrowLeft: { col: -1, row: 0 },
  ArrowRight: { col: 1, row: 0 },
};

/**
 * Where an arrow key takes the cursor: a row up or down, or a column across in the same row
 * (odd-q, so across zigzags half a hex), held at the map's edges. Null for any other key.
 */
export function stepCursor(
  at: Hex,
  key: string,
  map: { width: number; height: number },
): Hex | null {
  const step = STEPS[key];
  if (!step) return null;
  return {
    col: Math.min(map.width - 1, Math.max(0, at.col + step.col)),
    row: Math.min(map.height - 1, Math.max(0, at.row + step.row)),
  };
}

/** What a screen reader hears as the cursor lands on a hex. */
export function cursorText(cell: { label: string; party: boolean; destination: boolean }): string {
  const marks = [cell.party && 'the party is here', cell.destination && 'destination'];
  return [cell.label, ...marks.filter(Boolean)].join(', ');
}
