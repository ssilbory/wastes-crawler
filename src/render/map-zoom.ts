// Zoom for the overland map (Sam's ask): the steps it moves through, and where to scroll so the
// point being looked at stays put as the map grows or shrinks. Pure; src/ui/world/ZoomFrame.tsx
// applies it.

/** Zoom levels, as multiples of the map fitted to its frame. 1 is the whole map. */
export const ZOOMS = [1, 1.5, 2, 3, 4] as const;

/** The next zoom in (+1) or out (-1), held at the ends. */
export function stepZoom(zoom: number, dir: 1 | -1): number {
  const at = ZOOMS.findIndex((z) => z >= zoom);
  const i = at < 0 ? ZOOMS.length - 1 : at;
  const next = dir > 0 ? (ZOOMS[i] === zoom ? i + 1 : i) : i - 1;
  return ZOOMS[Math.min(ZOOMS.length - 1, Math.max(0, next))] as number;
}

/** A scroll box: how far it is scrolled, how much of it shows, and how big its content is. */
export interface ScrollBox {
  left: number;
  top: number;
  width: number;
  height: number;
  scrollWidth: number;
  scrollHeight: number;
}

/**
 * Where to scroll after zooming so that `focus` (a fraction of the content, 0 to 1 each way)
 * sits where it did in the view: at the same place in the frame, or in its middle when `centre`.
 */
export function refocus(
  before: ScrollBox,
  after: Pick<ScrollBox, 'width' | 'height' | 'scrollWidth' | 'scrollHeight'>,
  focus: { x: number; y: number },
  centre = false,
): { left: number; top: number } {
  // Where the focus sat in the frame, as a fraction of the frame.
  const fx = centre ? 0.5 : (focus.x * before.scrollWidth - before.left) / before.width;
  const fy = centre ? 0.5 : (focus.y * before.scrollHeight - before.top) / before.height;
  const clamp = (v: number, max: number) => Math.round(Math.min(Math.max(0, v), Math.max(0, max)));
  return {
    left: clamp(focus.x * after.scrollWidth - fx * after.width, after.scrollWidth - after.width),
    top: clamp(focus.y * after.scrollHeight - fy * after.height, after.scrollHeight - after.height),
  };
}

/** The middle of what the frame shows, as a fraction of the content. */
export const viewCentre = (box: ScrollBox) => ({
  x: (box.left + box.width / 2) / box.scrollWidth,
  y: (box.top + box.height / 2) / box.scrollHeight,
});

/** A box on the map, as fractions of its width and height, 0 to 1 each way. */
export interface MapBounds {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/**
 * The box about the hexes the party knows, `margin` pixels wider each way, as fractions of the
 * map; null when everything is known, since Fit already shows it all.
 */
export function knownBounds(
  cells: readonly { cx: number; cy: number; terrain: string | null }[],
  map: { width: number; height: number },
  margin: number,
): MapBounds | null {
  const known = cells.filter((c) => c.terrain !== null);
  if (known.length === 0 || known.length === cells.length) return null;
  const xs = known.map((c) => c.cx);
  const ys = known.map((c) => c.cy);
  const clamp = (v: number) => Math.min(1, Math.max(0, v));
  return {
    x0: clamp((Math.min(...xs) - margin) / map.width),
    y0: clamp((Math.min(...ys) - margin) / map.height),
    x1: clamp((Math.max(...xs) + margin) / map.width),
    y1: clamp((Math.max(...ys) + margin) / map.height),
  };
}

/**
 * The closest zoom that still shows all of `bounds` in a frame of `frame` pixels. Zoomed in, the
 * map fills the frame's width `zoom` times over and keeps its shape, so a box shows when it is no
 * wider than 1/zoom of the map and its height, so scaled, fits the frame's.
 */
export function fitZoom(
  bounds: MapBounds,
  frame: { width: number; height: number },
  map: { width: number; height: number },
): number {
  const tall = (frame.width * map.height) / map.width;
  const fits = (z: number) =>
    (bounds.x1 - bounds.x0) * z <= 1 && (bounds.y1 - bounds.y0) * z * tall <= frame.height;
  return [...ZOOMS].reverse().find(fits) ?? 1;
}
