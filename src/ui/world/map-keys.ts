import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cursorText, stepCursor } from '../../render/map-cursor.ts';
import type { HexCell } from '../../render/hex-view.ts';
import type { Hex } from '../../rules/hex.ts';

/**
 * The keyboard on a hex map (src/render/map-cursor.ts): the map takes focus with Tab, the arrow
 * keys move a cursor from the destination or the party, and Enter or Space picks the hex under
 * it as a click would. The cursor scrolls into view on a zoomed map, and its hex is read out.
 */
export function useMapKeys(cells: readonly HexCell[], onPick: (col: number, row: number) => void) {
  const [cursor, setCursor] = useState<Hex | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const size = {
    width: Math.max(0, ...cells.map((c) => c.col + 1)),
    height: Math.max(0, ...cells.map((c) => c.row + 1)),
  };
  const at = cursor && cells.find((c) => c.col === cursor.col && c.row === cursor.row);
  useLayoutEffect(() => {
    if (document.activeElement !== svg.current) return;
    svg.current
      ?.querySelector('.map-cursor')
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [cursor]);
  const onFocus = () => {
    if (cursor) return;
    const home = cells.find((c) => c.destination) ?? cells.find((c) => c.party) ?? cells[0];
    if (home) setCursor({ col: home.col, row: home.row });
  };
  const onKeyDown = (e: KeyboardEvent) => {
    if (!cursor) return;
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onPick(cursor.col, cursor.row);
      return;
    }
    const next = stepCursor(cursor, e.key, size);
    if (!next) return;
    e.preventDefault();
    setCursor(next);
  };
  return {
    svg,
    /** The hex under the cursor, to draw its outline. */
    at: at ?? null,
    /** What a screen reader hears as the cursor moves. */
    text: at ? cursorText(at) : '',
    handlers: { tabIndex: 0, onFocus, onKeyDown },
  };
}
