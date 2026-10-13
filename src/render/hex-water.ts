// Drawing data for where the overland map's water meets the land (docs/presentation-plan.md, V2):
// shorelines along every edge between a known water hex and known dry land, and a bridge where a
// road crosses a river or ford. The hexes themselves and their glyphs are in hex-art.ts.
import { hexKey, neighbors, parseHexKey } from '../rules/hex.ts';
import { WATER } from './hex-art.ts';
import type { HexCell } from './hex-view.ts';

const fmt = (n: number) => n.toFixed(1);

/** The six corners of a flat-topped hex, as in hexPoints. */
function corners(c: HexCell, size: number): [number, number][] {
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 3) * i;
    return [c.cx + size * Math.cos(a), c.cy + size * Math.sin(a)];
  });
}

/** The known hexes beside a hex. */
function beside(byKey: Map<string, HexCell>, c: HexCell): HexCell[] {
  return neighbors(parseHexKey(c.key))
    .map((h) => byKey.get(hexKey(h)))
    .filter((n): n is HexCell => n !== undefined && n.terrain !== null);
}

export interface Shore {
  /** The ink line along each edge where water meets land. */
  line: string;
  /** A paler line just inside the water, like a wash of shallows. */
  shallows: string;
}

/** Shorelines on every edge between a known water hex and the known dry land beside it. */
export function shores(cells: HexCell[], size: number): Shore {
  const byKey = new Map(cells.map((c) => [c.key, c]));
  const line: string[] = [];
  const shallows: string[] = [];
  for (const c of cells.filter((x) => WATER.has(x.terrain ?? ''))) {
    for (const n of beside(byKey, c).filter((x) => !WATER.has(x.terrain as string))) {
      // The two corners of this hex that the neighbour shares lie one radius from its centre.
      const [a, b] = corners(c, size).filter(
        ([x, y]) => Math.abs(Math.hypot(x - n.cx, y - n.cy) - size) < size * 0.05,
      ) as [[number, number], [number, number]];
      line.push(`M${fmt(a[0])},${fmt(a[1])}L${fmt(b[0])},${fmt(b[1])}`);
      // The same edge drawn a fifth of the way in toward the water's centre.
      const inward = ([x, y]: [number, number]) =>
        `${fmt(x + (c.cx - x) * 0.2)},${fmt(y + (c.cy - y) * 0.2)}`;
      shallows.push(`M${inward(a)}L${inward(b)}`);
    }
  }
  return { line: line.join(''), shallows: shallows.join('') };
}

/** A bridge: its centre, and the angle of the road across it, in degrees. */
export interface Bridge {
  key: string;
  x: number;
  y: number;
  angle: number;
}

/**
 * A bridge on every known road hex of river or ford, laid along the road: from the edge it enters
 * by to the edge it leaves by, or toward its one road neighbour, or east to west on its own.
 */
export function bridges(cells: HexCell[]): Bridge[] {
  const byKey = new Map(cells.map((c) => [c.key, c]));
  return cells
    .filter((c) => c.road && (c.terrain === 'river' || c.terrain === 'ford'))
    .map((c) => {
      const ends = beside(byKey, c).filter((n) => n.road || n.site !== null);
      const [from, to] =
        ends.length >= 2
          ? [ends[0] as HexCell, ends[1] as HexCell]
          : ends.length === 1
            ? [c, ends[0] as HexCell]
            : [null, null];
      const raw = from && to ? (Math.atan2(to.cy - from.cy, to.cx - from.cx) * 180) / Math.PI : 0;
      // A bridge looks the same either way across, so keep its angle within a half turn.
      const angle = raw <= -90 ? raw + 180 : raw > 90 ? raw - 180 : raw;
      return { key: c.key, x: c.cx, y: c.cy, angle: Math.round(angle * 10) / 10 };
    });
}
