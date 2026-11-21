// Masks for what stands in the pixel view (docs/presentation-plan.md, V8): which pixels of a box a
// shape covers, as the browser fills it, and how a figure built from them is laid into the frame
// with a dark outline, its lit rim, and its shaded edge, all whole pixels.
import { glows, MAT, type Mat } from './palette.ts';
import { put, type Frame } from './frame.ts';

/** A box of the frame in whole pixels, and which of its pixels are covered (1) or not (0). */
export interface Mask {
  x: number;
  y: number;
  w: number;
  h: number;
  on: Uint8Array;
}

export const emptyMask = (x: number, y: number, w: number, h: number): Mask => ({
  x,
  y,
  w,
  h,
  on: new Uint8Array(w * h),
});

/** Whether the mask covers frame pixel (x, y). */
export function covers(m: Mask, x: number, y: number): boolean {
  const lx = x - m.x;
  const ly = y - m.y;
  return lx >= 0 && ly >= 0 && lx < m.w && ly < m.h && m.on[ly * m.w + lx] === 1;
}

/** Calls `fn` with each covered pixel inside the frame and its index. */
function each(f: Frame, m: Mask, fn: (i: number, x: number, y: number) => void): void {
  for (let ly = 0; ly < m.h; ly++)
    for (let lx = 0; lx < m.w; lx++) {
      if (m.on[ly * m.w + lx] !== 1) continue;
      const [x, y] = [m.x + lx, m.y + ly];
      if (x >= 0 && y >= 0 && x < f.width && y < f.height) fn(y * f.width + x, x, y);
    }
}

/** Fills the mask's pixels with a material at a depth. */
export function stamp(f: Frame, m: Mask, mat: Mat, level: number, depth: number): void {
  each(f, m, (i) => put(f, i, mat, level, depth));
}

/** Every pixel either mask covers; both share `a`'s box. */
export function union(a: Mask, b: Mask): Mask {
  const out = emptyMask(a.x, a.y, a.w, a.h);
  for (let i = 0; i < out.on.length; i++) out.on[i] = a.on[i] === 1 || b.on[i] === 1 ? 1 : 0;
  return out;
}

/** The pixels of `m` whose neighbour (dx, dy) back is outside it: its edge facing away from it. */
export function edge(m: Mask, dx: number, dy: number): Mask {
  const out = emptyMask(m.x, m.y, m.w, m.h);
  for (let ly = 0; ly < m.h; ly++)
    for (let lx = 0; lx < m.w; lx++)
      if (m.on[ly * m.w + lx] === 1 && !covers(m, m.x + lx - dx, m.y + ly - dy))
        out.on[ly * m.w + lx] = 1;
  return out;
}

/** The pixels of `m` on its own border: those with a side neighbour outside it. */
export function rim(m: Mask): Mask {
  return union(union(edge(m, 1, 0), edge(m, -1, 0)), union(edge(m, 0, 1), edge(m, 0, -1)));
}

/** The ring of pixels just outside the mask, side by side or above and below. */
export function ring(m: Mask): Mask {
  const out = emptyMask(m.x - 1, m.y - 1, m.w + 2, m.h + 2);
  for (let ly = 0; ly < out.h; ly++)
    for (let lx = 0; lx < out.w; lx++) {
      const [x, y] = [out.x + lx, out.y + ly];
      if (covers(m, x, y)) continue;
      if (covers(m, x - 1, y) || covers(m, x + 1, y) || covers(m, x, y - 1) || covers(m, x, y + 1))
        out.on[ly * out.w + lx] = 1;
    }
  return out;
}

/** A dark outline around `m`, over whatever lies behind it at `depth`, never over what is nearer. */
export function outline(f: Frame, m: Mask, depth: number): void {
  each(f, ring(m), (i) => {
    if ((f.depth[i] as number) > depth) put(f, i, MAT.void, 0, depth);
  });
}

/** Brightens (or with a negative `by`, darkens) the mask's pixels laid at `depth`, if not glowing. */
export function lift(f: Frame, m: Mask, by: number, depth: number): void {
  const at = Math.fround(depth);
  each(f, m, (i) => {
    if (f.depth[i] !== at || glows(f.mat[i] as Mat)) return;
    f.level[i] = Math.max(0, Math.min(1, (f.level[i] as number) + by));
  });
}
