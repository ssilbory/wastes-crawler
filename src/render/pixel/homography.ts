// Perspective mapping between a panel's screen quad and its texture's unit square (docs/
// presentation-plan.md, V8), so stone courses and planks recede with the wall they are laid in.
// The square's corners (0,0), (1,0), (1,1), (0,1) go to the quad's top-left, top-right,
// bottom-right, and bottom-left (Heckbert's square-to-quad projection).
import type { Quad } from '../dungeon-quad.ts';

/** A 3 by 3 matrix, row by row. */
export type Mat3 = [number, number, number, number, number, number, number, number, number];

/** The projection taking the unit square onto `q`. */
export function squareToQuad(q: Quad): Mat3 {
  const [[x0, y0], [x1, y1], [x2, y2], [x3, y3]] = q;
  const sx = x0 - x1 + x2 - x3;
  const sy = y0 - y1 + y2 - y3;
  if (Math.abs(sx) < 1e-9 && Math.abs(sy) < 1e-9)
    // A parallelogram: no perspective at all.
    return [x1 - x0, x3 - x0, x0, y1 - y0, y3 - y0, y0, 0, 0, 1];
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const den = dx1 * dy2 - dx2 * dy1;
  // Three corners in a line: no face to map, and no inverse.
  if (Math.abs(den) < 1e-9) return [0, 0, x0, 0, 0, y0, 0, 0, 1];
  const g = (sx * dy2 - dx2 * sy) / den;
  const h = (dx1 * sy - sx * dy1) / den;
  return [x1 - x0 + g * x1, x3 - x0 + h * x3, x0, y1 - y0 + g * y1, y3 - y0 + h * y3, y0, g, h, 1];
}

/** The inverse of `m`, or null when it flattens the plane to a line. */
export function invert(m: Mat3): Mat3 | null {
  const [a, b, c, d, e, f, g, h, i] = m;
  const A = e * i - f * h;
  const B = f * g - d * i;
  const C = d * h - e * g;
  const det = a * A + b * B + c * C;
  if (Math.abs(det) < 1e-9) return null;
  const k = 1 / det;
  return [
    A * k,
    (c * h - b * i) * k,
    (b * f - c * e) * k,
    B * k,
    (a * i - c * g) * k,
    (c * d - a * f) * k,
    C * k,
    (b * g - a * h) * k,
    (a * e - b * d) * k,
  ];
}

/** Applies `m` to (x, y), writing the result into `out`. */
export function project(m: Mat3, x: number, y: number, out: [number, number]): void {
  const w = m[6] * x + m[7] * y + m[8];
  out[0] = (m[0] * x + m[1] * y + m[2]) / w;
  out[1] = (m[3] * x + m[4] * y + m[5]) / w;
}
