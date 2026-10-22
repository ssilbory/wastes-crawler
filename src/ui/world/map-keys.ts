import { useRef, useState } from 'preact/hooks';
import { stepCursor } from '../../render/map-cursor.ts';
import type { HexCell } from '../../render/hex-view.ts';
import { hexKey } from '../../rules/hex.ts';

/**
 * The keyboard on a hex map (src/render/map-cursor.ts). Every hex is a button, but only one is in
 * the Tab order: the last one focused, else the destination, else the party's. The arrow keys move
 * focus hex to hex, scrolling a zoomed map with it, and Enter or Space picks the hex as a click
 * would.
 */
export function useMapKeys(cells: readonly HexCell[], onPick: (col: number, row: number) => void) {
  const [last, setLast] = useState<string | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const size = {
    width: Math.max(0, ...cells.map((c) => c.col + 1)),
    height: Math.max(0, ...cells.map((c) => c.row + 1)),
  };
  const current =
    cells.find((c) => c.key === last) ??
    cells.find((c) => c.destination) ??
    cells.find((c) => c.party) ??
    cells[0];
  const onKeyDown = (e: KeyboardEvent) => {
    if (!current) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(current.col, current.row);
      return;
    }
    const next = stepCursor(current, e.key, size);
    if (!next) return;
    e.preventDefault();
    const key = hexKey(next);
    setLast(key);
    svg.current?.querySelector<SVGGElement>(`[data-hex="${key}"]`)?.focus();
  };
  return {
    svg,
    /** The hex that takes Tab. */
    tabStop: current?.key ?? null,
    onKeyDown,
    /** A hex took focus, by the keys or a click: Tab comes back to it. */
    onFocus: (cell: HexCell) => setLast(cell.key),
  };
}
