import { createPortal } from 'preact/compat';
import { useEffect, useRef, useState } from 'preact/hooks';
import type { HexCell } from '../../render/hex-view.ts';
import { hexTip } from '../../render/map-tip.ts';

/** How long a finger rests on a hex before its tooltip shows (Sam's ask: a long press). */
const LONG_PRESS_MS = 450;
/** How far a finger may drift, in CSS pixels, and still be pressing rather than scrolling. */
const SLOP = 10;
/** Room the tooltip keeps from the window's edges, and the half-width it plans for. */
const EDGE = 8;
const HALF = 120;

interface Shown {
  cell: HexCell;
  rect: DOMRect;
}

/**
 * The overland map's tooltip (src/render/map-tip.ts): on hover with a mouse, on a long press with
 * a finger, and when the keyboard moves onto a hex. A tap still picks the hex as before; a long
 * press only shows the tooltip, swallowing the click and the browser's own long-press menu. A
 * finger's tooltip stays until the next touch. The hex itself carries the same words as its name,
 * so the tooltip is hidden from screen readers.
 */
export function useMapTip() {
  const [shown, setShown] = useState<Shown | null>(null);
  const press = useRef<{ timer: number; x: number; y: number } | null>(null);
  /** A long press just showed a tooltip: the click it ends in is not a pick. */
  const longPressed = useRef(false);

  const show = (cell: HexCell, el: Element) => setShown({ cell, rect: el.getBoundingClientRect() });
  const hide = (cell: HexCell) => setShown((s) => (s?.cell.key === cell.key ? null : s));
  const cancel = () => {
    if (press.current) window.clearTimeout(press.current.timer);
    press.current = null;
  };

  // A touch tooltip stays put until the next touch, wherever it lands.
  useEffect(() => {
    if (!shown) return;
    const off = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') setShown(null);
    };
    document.addEventListener('pointerdown', off, true);
    return () => document.removeEventListener('pointerdown', off, true);
  }, [shown]);
  useEffect(() => cancel, []);

  /** The handlers for one hex's group. */
  const hexProps = (cell: HexCell) => ({
    onPointerEnter: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') show(cell, e.currentTarget as Element);
    },
    onPointerLeave: (e: PointerEvent) => {
      if (e.pointerType === 'mouse') hide(cell);
    },
    onPointerDown: (e: PointerEvent) => {
      longPressed.current = false;
      if (e.pointerType === 'mouse') return;
      cancel();
      const el = e.currentTarget as Element;
      press.current = {
        x: e.clientX,
        y: e.clientY,
        timer: window.setTimeout(() => {
          press.current = null;
          longPressed.current = true;
          show(cell, el);
        }, LONG_PRESS_MS),
      };
    },
    onPointerMove: (e: PointerEvent) => {
      const p = press.current;
      if (p && Math.hypot(e.clientX - p.x, e.clientY - p.y) > SLOP) cancel();
    },
    onPointerUp: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e: Event) => {
      if (longPressed.current || press.current) e.preventDefault();
    },
    onFocus: (e: FocusEvent) => {
      const el = e.currentTarget as Element;
      // Only the keyboard's focus: a tap or a click focuses the hex too.
      if (el.matches(':focus-visible')) show(cell, el);
    },
    onBlur: () => hide(cell),
  });

  /** Wraps a hex's click so the end of a long press doesn't pick it. */
  const onClick = (pick: () => void) => (e: Event) => {
    if (longPressed.current) {
      longPressed.current = false;
      e.preventDefault();
      return;
    }
    pick();
  };

  const tip = shown ? hexTip(shown.cell) : null;
  const element =
    shown && tip
      ? createPortal(<Tip rect={shown.rect} title={tip.title} lines={tip.lines} />, document.body)
      : null;
  return { hexProps, onClick, element };
}

function Tip(props: { rect: DOMRect; title: string; lines: string[] }) {
  const { rect } = props;
  const width = window.innerWidth;
  const half = Math.min(HALF, width / 2 - EDGE);
  const left = Math.min(width - half - EDGE, Math.max(half + EDGE, rect.left + rect.width / 2));
  // Above the hex, unless that runs off the top of the window.
  const below = rect.top < 72;
  return (
    <div
      class={`map-tip${below ? ' below' : ''}`}
      role="tooltip"
      aria-hidden="true"
      style={{ left: `${left}px`, top: `${below ? rect.bottom : rect.top}px` }}
    >
      <strong>{props.title}</strong>
      {props.lines.map((l) => (
        <span key={l}>{l}</span>
      ))}
    </div>
  );
}
