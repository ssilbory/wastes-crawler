// Which hex each pixel of the pixel overland lies in (docs/presentation-plan.md, V8). The map is
// drawn at one pixel for every two map units, so a hex of radius 18 is 18 pixels across; each
// pixel's centre is matched to the nearest hex centre in the odd-q layout (hex-view.ts), and kept
// only if it lies inside that hexagon.
import { hexCenter } from '../hex-view.ts';

/** Map units per pixel. */
export const UNIT = 2;

export interface HexGrid {
  width: number;
  height: number;
  cols: number;
  rows: number;
  /** For each pixel, its hex as row * cols + col, or -1 outside every hex. */
  at: Int32Array;
}

const SQRT3 = Math.sqrt(3);

/** Whether (dx, dy) from a flat-topped hex's centre lies inside it. */
export const insideHex = (dx: number, dy: number, size: number): boolean => {
  const [ax, ay] = [Math.abs(dx), Math.abs(dy)];
  return ay <= (SQRT3 / 2) * size && SQRT3 * ax + ay <= SQRT3 * size;
};

const grids = new Map<string, HexGrid>();

/** The grid for a map of `cols` by `rows` hexes, `mapWidth` by `mapHeight` map units; kept. */
export function hexGrid(
  mapWidth: number,
  mapHeight: number,
  cols: number,
  rows: number,
  size: number,
): HexGrid {
  const key = `${mapWidth}x${mapHeight}:${cols}x${rows}:${size}`;
  const kept = grids.get(key);
  if (kept) return kept;
  const width = Math.ceil(mapWidth / UNIT);
  const height = Math.ceil(mapHeight / UNIT);
  const at = new Int32Array(width * height).fill(-1);
  for (let py = 0; py < height; py++)
    for (let px = 0; px < width; px++) {
      const [x, y] = [(px + 0.5) * UNIT, (py + 0.5) * UNIT];
      const c0 = Math.round((x - size) / (1.5 * size));
      let best = -1;
      let near = Infinity;
      for (let col = c0 - 1; col <= c0 + 1; col++) {
        if (col < 0 || col >= cols) continue;
        const r0 = Math.round((y - (SQRT3 / 2) * size) / (SQRT3 * size) - (col % 2) * 0.5);
        for (let row = r0 - 1; row <= r0 + 1; row++) {
          if (row < 0 || row >= rows) continue;
          const c = hexCenter({ col, row }, size);
          const d = (x - c.x) ** 2 + (y - c.y) ** 2;
          if (d < near && insideHex(x - c.x, y - c.y, size)) {
            near = d;
            best = row * cols + col;
          }
        }
      }
      at[py * width + px] = best;
    }
  const grid = { width, height, cols, rows, at };
  if (grids.size > 8) grids.clear();
  grids.set(key, grid);
  return grid;
}
