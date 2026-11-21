// Fills the pixel view's shapes into whole pixels with the browser's own path filling
// (src/render/pixel/sprites.ts, docs/presentation-plan.md, V8): each shape on a scratch canvas,
// read back, and kept where it covers at least about half a pixel.
import { emptyMask } from '../../render/pixel/mask.ts';
import type { Rasterize } from '../../render/pixel/sprites.ts';

let scratch: CanvasRenderingContext2D | null = null;
const paths = new Map<string, Path2D>();

/** The scratch canvas, at least `w` by `h`. */
function context(w: number, h: number): CanvasRenderingContext2D | null {
  if (!scratch) {
    const canvas = document.createElement('canvas');
    scratch = canvas.getContext('2d', { willReadFrequently: true });
  }
  if (scratch && (scratch.canvas.width < w || scratch.canvas.height < h)) {
    scratch.canvas.width = Math.max(scratch.canvas.width, w);
    scratch.canvas.height = Math.max(scratch.canvas.height, h);
  }
  return scratch;
}

function pathOf(d: string): Path2D {
  let p = paths.get(d);
  if (!p) {
    p = new Path2D(d);
    // The same art comes back on every step; keep the cache from growing without end.
    if (paths.size > 2000) paths.clear();
    paths.set(d, p);
  }
  return p;
}

/** How much of a pixel a shape must cover to count, out of 255. */
const COVER = 110;

export const rasterize: Rasterize = (s) => {
  const m = emptyMask(s.box.x, s.box.y, s.box.w, s.box.h);
  const ctx = m.w > 0 && m.h > 0 ? context(m.w, m.h) : null;
  if (!ctx) return m;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, m.w, m.h);
  const [a, b, c, d, e, f] = s.matrix;
  ctx.setTransform(a, b, c, d, e - m.x, f - m.y);
  const path = pathOf(s.d);
  if (s.stroke === null) {
    ctx.fillStyle = '#fff';
    ctx.fill(path);
  } else {
    // No line thinner than a pixel, so a far figure's eyes and a tripwire still show.
    const scale = Math.sqrt(Math.abs(a * d - b * c)) || 1;
    ctx.lineWidth = Math.max(s.stroke, 1 / scale);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#fff';
    ctx.stroke(path);
  }
  const px = ctx.getImageData(0, 0, m.w, m.h).data;
  for (let i = 0; i < m.on.length; i++) m.on[i] = (px[i * 4 + 3] as number) >= COVER ? 1 : 0;
  return m;
};
