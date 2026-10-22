import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import {
  fitZoom,
  refocus,
  stepZoom,
  viewCentre,
  ZOOMS,
  type MapBounds,
  type ScrollBox,
} from '../../render/map-zoom.ts';

const boxOf = (el: HTMLElement): ScrollBox => ({
  left: el.scrollLeft,
  top: el.scrollTop,
  width: el.clientWidth,
  height: el.clientHeight,
  scrollWidth: el.scrollWidth,
  scrollHeight: el.scrollHeight,
});

/**
 * A map that zooms (src/render/map-zoom.ts): −, +, and Fit buttons in its corner, and Ctrl with
 * the wheel (or a trackpad pinch) about the pointer. Zoomed in, the map scrolls in its frame; at
 * Fit it is drawn as before, whole. Zooming in from Fit closes in on `focus`, such as the party.
 * With `start`, it opens as close in as shows all of that box, centred on it.
 */
export function ZoomFrame(props: {
  /** The class the scrolling box takes, as the map's frame had before. */
  class: string;
  /** Where to close in from Fit, as a fraction of the map each way; the middle if none. */
  focus?: { x: number; y: number } | null;
  /** What to show on opening, such as the hexes the party knows; the whole map if none. */
  start?: MapBounds | null;
  /** The map's own size, for its shape when zoomed; needed with `start`. */
  size?: { width: number; height: number };
  children: ComponentChildren;
}) {
  const [zoom, setZoom] = useState(1);
  const scroller = useRef<HTMLDivElement>(null);
  const pending = useRef<{ before: ScrollBox; focus: { x: number; y: number }; centre: boolean }>(
    null,
  );
  const zoomTo = (next: number, at?: { x: number; y: number }, centre = at === undefined) => {
    const el = scroller.current;
    if (!el || next === zoom) return;
    const before = boxOf(el);
    const focus = at ?? (zoom === 1 && props.focus ? props.focus : viewCentre(before));
    pending.current = { before, focus, centre };
    setZoom(next);
  };
  // Once the map has its new size, scroll so the focus is where it should be.
  useLayoutEffect(() => {
    const el = scroller.current;
    const p = pending.current;
    if (!el || !p) return;
    pending.current = null;
    const { left, top } = refocus(p.before, boxOf(el), p.focus, p.centre);
    el.scrollLeft = left;
    el.scrollTop = top;
  }, [zoom]);
  // On opening, close in on `start`: only then, so the player's own zoom is theirs after.
  useLayoutEffect(() => {
    const el = scroller.current;
    const { start, size } = props;
    if (!el || !start || !size) return;
    const next = fitZoom(start, { width: el.clientWidth, height: el.clientHeight }, size);
    zoomTo(next, { x: (start.x0 + start.x1) / 2, y: (start.y0 + start.y1) / 2 }, true);
  }, []);
  const onWheel = (e: WheelEvent) => {
    const el = scroller.current;
    if (!e.ctrlKey || !el) return;
    e.preventDefault();
    const r = el.getBoundingClientRect();
    zoomTo(stepZoom(zoom, e.deltaY < 0 ? 1 : -1), {
      x: (el.scrollLeft + e.clientX - r.left) / el.scrollWidth,
      y: (el.scrollTop + e.clientY - r.top) / el.scrollHeight,
    });
  };
  const max = ZOOMS[ZOOMS.length - 1] as number;
  return (
    <div class="zoom-frame">
      <div
        ref={scroller}
        class={`${props.class} zoom-scroll ${zoom === 1 ? 'fit' : 'zoomed'}`}
        onWheel={onWheel}
      >
        <div class="zoom-content" style={zoom === 1 ? undefined : { width: `${zoom * 100}%` }}>
          {props.children}
        </div>
      </div>
      <div class="zoom-controls" role="group" aria-label="Zoom">
        <button
          type="button"
          aria-label="Zoom out"
          disabled={zoom === 1}
          onClick={() => zoomTo(stepZoom(zoom, -1))}
        >
          −
        </button>
        <span class="zoom-level" aria-live="polite">
          {zoom}×
        </span>
        <button
          type="button"
          aria-label="Zoom in"
          disabled={zoom === max}
          onClick={() => zoomTo(stepZoom(zoom, 1))}
        >
          +
        </button>
        <button type="button" disabled={zoom === 1} onClick={() => zoomTo(1)}>
          Fit
        </button>
      </div>
    </div>
  );
}
