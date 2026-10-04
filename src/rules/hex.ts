// Hex grid geometry for the overland map (docs/rules-adaptation.md, Overland map). Hexes use
// "odd-q" offset coordinates: flat-topped columns, with odd columns shifted half a hex down.

export interface Hex {
  col: number;
  row: number;
}

export const hexKey = (h: Hex) => `${h.col},${h.row}`;

export function parseHexKey(key: string): Hex {
  const [col, row] = key.split(',').map(Number);
  if (col === undefined || row === undefined || !Number.isInteger(col) || !Number.isInteger(row))
    throw new Error(`invalid hex key ${key}`);
  return { col, row };
}

const EVEN: readonly (readonly [number, number])[] = [
  [1, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
  [-1, -1],
  [0, -1],
];
const ODD: readonly (readonly [number, number])[] = [
  [1, 0],
  [1, 1],
  [0, 1],
  [-1, 1],
  [-1, 0],
  [0, -1],
];

/** The six neighbors, clockwise from the upper right; callers drop those off the map. */
export function neighbors(h: Hex): Hex[] {
  return (h.col % 2 === 0 ? EVEN : ODD).map(([dc, dr]) => ({ col: h.col + dc, row: h.row + dr }));
}

function toCube(h: Hex): [number, number, number] {
  const x = h.col;
  const z = h.row - (h.col - (h.col & 1)) / 2;
  return [x, -x - z, z];
}

export function distance(a: Hex, b: Hex): number {
  const [ax, ay, az] = toCube(a);
  const [bx, by, bz] = toCube(b);
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by), Math.abs(az - bz));
}
