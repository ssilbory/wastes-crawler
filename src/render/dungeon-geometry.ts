// Geometry of the first-person view (docs/plan.md, Phase 7): view planes one cell apart, shrinking
// toward the vanishing point, and the quads of the walls, floors, and ceilings between them.
import type { Point, Quad } from './dungeon-detail.ts';

export const VIEW_WIDTH = 320;
export const VIEW_HEIGHT = 240;
export const VIEW_DEPTH = 4;

export interface Span {
  near: number;
  far: number;
  from: Point;
  to: Point;
}

const mid = (a: Point, b: Point): Point => [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
/** A panel square to the view, all at one distance. */
export const flatOn = (k: number, q: Quad): Span => ({ near: k, far: k, from: q[0], to: q[0] });
/** A wall running away from the party: near edge on the left of the quad. */
export const alongSide = (depth: number, q: Quad): Span => ({
  near: depth,
  far: depth + 1,
  from: mid(q[0], q[3]),
  to: mid(q[1], q[2]),
});
/** A floor or ceiling square: far edge first in the quad. */
export const alongFlat = (depth: number, q: Quad): Span => ({
  near: depth,
  far: depth + 1,
  from: mid(q[2], q[3]),
  to: mid(q[0], q[1]),
});

const CX = VIEW_WIDTH / 2;
const CY = VIEW_HEIGHT / 2;
/** Half the width and height of the view plane k cell-lengths ahead of the party. */
const hw = (k: number) => CX / (k + 1);
const hh = (k: number) => CY / (k + 1);

export const fmt = (q: readonly Point[]) =>
  q.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(' ');

/** The x of the line `lateral` cells right of centre, in half cells, on plane k. */
const xAt = (halfCells: number, k: number) => CX + halfCells * hw(k);

/** The upright plane k cell-lengths ahead, one cell wide, `lateral` cells right of centre. */
export function upright(k: number, lateral: number): Quad {
  const [l, r] = [xAt(2 * lateral - 1, k), xAt(2 * lateral + 1, k)];
  return [
    [l, CY - hh(k)],
    [r, CY - hh(k)],
    [r, CY + hh(k)],
    [l, CY + hh(k)],
  ];
}

/** The wall on the far side of a cell. */
export const front = (depth: number, lateral: number): Quad => upright(depth + 1, lateral);

/** A side wall from the near plane to the far one, near edge first. */
export function sideWall(depth: number, halfCells: number): Quad {
  const [near, far] = [depth, depth + 1];
  return [
    [xAt(halfCells, near), CY - hh(near)],
    [xAt(halfCells, far), CY - hh(far)],
    [xAt(halfCells, far), CY + hh(far)],
    [xAt(halfCells, near), CY + hh(near)],
  ];
}

/** The floor (or ceiling) square of a cell, near edge at the bottom of the quad's order. */
export function flat(depth: number, lateral: number, ceiling: boolean): Quad {
  const [near, far] = [depth, depth + 1];
  const y = (k: number) => (ceiling ? CY - hh(k) : CY + hh(k));
  return [
    [xAt(2 * lateral - 1, far), y(far)],
    [xAt(2 * lateral + 1, far), y(far)],
    [xAt(2 * lateral + 1, near), y(near)],
    [xAt(2 * lateral - 1, near), y(near)],
  ];
}

/**
 * A 48-unit box standing on the floor at plane k, centred on the cell `lateral` across and as wide
 * as that cell, so anything drawn in it stands on y = 46 of the box (furniture-art.ts).
 */
export function standIn(k: number, lateral: number): { x: number; y: number; size: number } {
  const size = 2 * hw(k);
  return { x: xAt(2 * lateral, k) - size / 2, y: CY + hh(k) - (size * 46) / 48, size };
}
