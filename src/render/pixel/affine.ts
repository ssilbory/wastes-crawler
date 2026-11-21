// 2D affine transforms for the pixel view (docs/presentation-plan.md, V8): the figures' SVG
// transform strings (figure-art.ts, figure-draw.ts) read as matrices, so the same art can be
// filled into the frame at any box.

/** [a, b, c, d, e, f], as SVG's matrix(a b c d e f): x' = a x + c y + e, y' = b x + d y + f. */
export type Affine = [number, number, number, number, number, number];

export const IDENTITY: Affine = [1, 0, 0, 1, 0, 0];

/** `m` then `n`: n applied in m's coordinates, as SVG lists them left to right. */
export function compose(m: Affine, n: Affine): Affine {
  const [a, b, c, d, e, f] = m;
  const [A, B, C, D, E, F] = n;
  return [
    a * A + c * B,
    b * A + d * B,
    a * C + c * D,
    b * C + d * D,
    a * E + c * F + e,
    b * E + d * F + f,
  ];
}

export const translate = (x: number, y: number): Affine => [1, 0, 0, 1, x, y];
export const scale = (x: number, y = x): Affine => [x, 0, 0, y, 0, 0];

function rotate(deg: number, cx = 0, cy = 0): Affine {
  const r = (deg * Math.PI) / 180;
  const [cos, sin] = [Math.cos(r), Math.sin(r)];
  return compose(compose(translate(cx, cy), [cos, sin, -sin, cos, 0, 0]), translate(-cx, -cy));
}

/** An SVG transform list (translate, scale, rotate, matrix) as one matrix. */
export function parseTransform(s: string): Affine {
  let m = IDENTITY;
  for (const [, name, args] of s.matchAll(/(\w+)\s*\(([^)]*)\)/g)) {
    const n = (args as string)
      .split(/[\s,]+/)
      .filter(Boolean)
      .map(Number);
    const [p = 0, q, r, t, u, v] = n;
    const step: Affine =
      name === 'translate'
        ? translate(p, q ?? 0)
        : name === 'scale'
          ? scale(p, q ?? p)
          : name === 'rotate'
            ? rotate(p, q, r)
            : name === 'matrix'
              ? [p, q ?? 0, r ?? 0, t ?? 1, u ?? 0, v ?? 0]
              : IDENTITY;
    m = compose(m, step);
  }
  return m;
}
