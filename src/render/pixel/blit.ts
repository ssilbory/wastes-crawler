// Laying the overland's sprites and lines into a frame (docs/presentation-plan.md, V8): a bitmap
// at a pixel, ringed in black if it asks to be, and a filled shape painted in one colour. Both keep
// each pixel's depth, which on the overland marks whether its hex is visited, seen, or fogged.
import { heightOf, INK, widthOf, type Bitmap } from './bitmaps.ts';
import type { Frame } from './frame.ts';
import { emptyMask, ring, type Mask } from './mask.ts';
import { MAT, type Mat } from './palette.ts';

/** Sets one pixel's material and brightness, keeping its depth; off the frame is skipped. */
function paintAt(f: Frame, x: number, y: number, mat: Mat, level: number, depth?: number): void {
  if (x < 0 || y < 0 || x >= f.width || y >= f.height) return;
  const i = y * f.width + x;
  f.mat[i] = mat;
  f.level[i] = level;
  if (depth !== undefined) f.depth[i] = depth;
}

/** The pixels a bitmap covers, with its top-left at (x, y). */
export function bitmapMask(b: Bitmap, x: number, y: number): Mask {
  const m = emptyMask(x, y, widthOf(b), heightOf(b));
  b.rows.forEach((row, ly) =>
    [...row].forEach((ch, lx) => {
      if (ch !== '.') m.on[ly * m.w + lx] = 1;
    }),
  );
  return m;
}

/**
 * Lays a bitmap with its centre at (cx, cy). With `depth`, its pixels take that depth (the marks
 * layer, laid over nothing); without, they keep the depth of what lies beneath.
 */
export function blit(f: Frame, b: Bitmap, cx: number, cy: number, depth?: number): void {
  const x = Math.round(cx - widthOf(b) / 2);
  const y = Math.round(cy - heightOf(b) / 2);
  if (b.outline) {
    const r = ring(bitmapMask(b, x, y));
    for (let ly = 0; ly < r.h; ly++)
      for (let lx = 0; lx < r.w; lx++)
        if (r.on[ly * r.w + lx] === 1) paintAt(f, r.x + lx, r.y + ly, MAT.void, 0, depth);
  }
  b.rows.forEach((row, ly) =>
    [...row].forEach((ch, lx) => {
      const ink = INK[ch];
      if (ink) paintAt(f, x + lx, y + ly, ink[0], ink[1], depth);
    }),
  );
}

/** Paints a mask's pixels one colour, keeping their depth. */
export function paint(f: Frame, m: Mask, mat: Mat, level: number): void {
  for (let ly = 0; ly < m.h; ly++)
    for (let lx = 0; lx < m.w; lx++)
      if (m.on[ly * m.w + lx] === 1) paintAt(f, m.x + lx, m.y + ly, mat, level);
}
