// Drawing data for the overland map's art (docs/presentation-plan.md, V2): terrain glyphs set
// about each known hex, roads and rivers as lines joining hex to hex, and the tint for the quarter
// of the day. Placement varies by a hash of the hex, never the RNG, so a hex looks the same on
// every visit. The glyphs themselves are SVG symbols in src/ui/world/HexArt.tsx.
import { hexKey, neighbors, parseHexKey } from '../rules/hex.ts';
import { hash01 } from './dungeon-detail.ts';
import type { HexCell } from './hex-view.ts';

/** One glyph: the symbol to use, its centre, and its size in map units. */
export interface Glyph {
  symbol: string;
  x: number;
  y: number;
  size: number;
}

/**
 * Where a terrain's glyphs sit, as offsets from the hex centre in hex radii, and how big each is.
 * Water glyphs sit centred; land glyphs scatter so the hex reads as country, not a tile.
 */
const SLOTS: Record<string, { at: [number, number][]; size: number; jitter: number }> = {
  plains: {
    at: [
      [-0.38, -0.2],
      [0.32, 0.28],
    ],
    size: 0.42,
    jitter: 0.12,
  },
  forest: {
    at: [
      [-0.32, -0.12],
      [0.28, -0.22],
      [0.02, 0.3],
    ],
    size: 0.55,
    jitter: 0.08,
  },
  'deep-forest': {
    at: [
      [-0.42, -0.18],
      [0.0, -0.36],
      [0.42, -0.14],
      [-0.22, 0.28],
      [0.24, 0.3],
    ],
    size: 0.5,
    jitter: 0.06,
  },
  hills: {
    at: [
      [-0.26, -0.12],
      [0.26, 0.2],
    ],
    size: 0.62,
    jitter: 0.08,
  },
  mountains: {
    at: [
      [-0.2, 0.02],
      [0.3, 0.16],
    ],
    size: 0.78,
    jitter: 0.06,
  },
  swamp: {
    at: [
      [-0.3, -0.14],
      [0.3, 0.2],
    ],
    size: 0.5,
    jitter: 0.1,
  },
  badlands: {
    at: [
      [-0.24, -0.08],
      [0.28, 0.24],
    ],
    size: 0.55,
    jitter: 0.1,
  },
  desert: {
    at: [
      [-0.34, -0.16],
      [0.3, 0.26],
    ],
    size: 0.4,
    jitter: 0.14,
  },
  dunes: {
    at: [
      [-0.3, -0.18],
      [0.28, 0.06],
      [-0.06, 0.34],
    ],
    size: 0.55,
    jitter: 0.08,
  },
  'salt-flats': {
    at: [
      [-0.3, -0.1],
      [0.3, 0.22],
    ],
    size: 0.45,
    jitter: 0.12,
  },
  oasis: { at: [[0, 0.08]], size: 0.75, jitter: 0 },
  lake: { at: [[0, 0]], size: 0.9, jitter: 0 },
  river: { at: [[0, 0.36]], size: 0.5, jitter: 0.04 },
  ford: { at: [[0, 0]], size: 0.7, jitter: 0 },
};

/** Hexes of water: rivers, the fords across them, and lakes. */
export const WATER = new Set(['river', 'ford', 'lake']);

/** The glyphs for a known hex, or none for one under fog or of a terrain with no glyph. */
export function glyphsFor(cell: HexCell, size: number): Glyph[] {
  const slots = cell.terrain ? SLOTS[cell.terrain] : undefined;
  if (!cell.terrain || !slots) return [];
  // A town, dungeon, grove, or bridge keeps the middle of its hex clear for its icon.
  const busy =
    cell.site !== null ||
    cell.dungeon !== null ||
    cell.grove !== null ||
    (cell.road && WATER.has(cell.terrain));
  return slots.at
    .filter(([dx, dy]) => !busy || Math.hypot(dx, dy) > 0.3)
    .map(([dx, dy], i) => {
      const jx = (hash01(`${cell.key}:${i}:x`) - 0.5) * 2 * slots.jitter;
      const jy = (hash01(`${cell.key}:${i}:y`) - 0.5) * 2 * slots.jitter;
      return {
        symbol: `hg-${cell.terrain}`,
        x: cell.cx + (dx + jx) * size,
        y: cell.cy + (dy + jy) * size,
        size: slots.size * size * (1.05 + hash01(`${cell.key}:${i}:s`) * 0.25),
      };
    });
}

const fmt = (n: number) => n.toFixed(1);

/**
 * A course through linked hexes: in each hex, a curve from the edge it enters by to the edge it
 * leaves by, bending through the hex centre, so a run of hexes draws one smooth line. At an end
 * or a crossroads each way runs straight to the centre, and a hex linked to nothing draws a dot,
 * so it still shows.
 */
function joins(cells: HexCell[], on: (c: HexCell) => boolean, to: (c: HexCell) => boolean) {
  const byKey = new Map(cells.map((c) => [c.key, c]));
  const parts: string[] = [];
  for (const c of cells.filter(on)) {
    const edges = neighbors(parseHexKey(c.key))
      .map((h) => byKey.get(hexKey(h)))
      .filter((n): n is HexCell => n !== undefined && to(n))
      .map((n) => `${fmt((c.cx + n.cx) / 2)},${fmt((c.cy + n.cy) / 2)}`);
    const centre = `${fmt(c.cx)},${fmt(c.cy)}`;
    if (edges.length === 0) parts.push(`M${centre}h0.1`);
    else if (edges.length === 2)
      parts.push(`M${edges[0] as string}Q${centre} ${edges[1] as string}`);
    // An end, or a crossroads: each way runs straight in to the centre.
    else for (const e of edges) parts.push(`M${centre}L${e}`);
  }
  return parts.join('');
}

/** Roads between known road hexes, and on into the towns beside them. */
export function roadPath(cells: HexCell[]): string {
  const road = (c: HexCell) => c.road;
  return joins(cells, road, (n) => n.road || n.site !== null);
}

/** A river's course through known river and ford hexes, joining lakes beside it. */
export function riverPath(cells: HexCell[]): string {
  const flowing = (c: HexCell) => c.terrain === 'river' || c.terrain === 'ford';
  return joins(cells, flowing, (n) => WATER.has(n.terrain ?? ''));
}

/** The light over the map by the quarter of the day: morning, day, evening, night. */
export interface DayTint {
  color: string;
  opacity: number;
}

const TINTS: DayTint[] = [
  { color: '#f2c7a0', opacity: 0.16 },
  { color: '#ffffff', opacity: 0 },
  { color: '#d9824a', opacity: 0.2 },
  { color: '#1d2a4a', opacity: 0.42 },
];

export const dayTint = (quarter: number): DayTint => TINTS[quarter] as DayTint;

/** SRD 2.12.0: a standard hex is six miles across (vendor/wwn-srd/2.0 The Rules of the Game/
 * 2.12.0 Wilderness Exploration and Expeditions.md). */
export const HEX_MILES = 6;

/** A scale bar: its ink, alternating light and dark hex-long blocks, and its label. */
export interface ScaleBar {
  x: number;
  y: number;
  /** One block per hex, from left to right. */
  blocks: { x: number; width: number; dark: boolean }[];
  height: number;
  label: string;
}

/**
 * A bar `hexes` long in the map's bottom left corner, one block per hex measured centre to centre,
 * labelled in miles.
 */
export function scaleBar(mapHeight: number, size: number, hexes = 5): ScaleBar {
  const step = size * Math.sqrt(3);
  const x = size * 0.8;
  return {
    x,
    y: mapHeight - size * 0.9,
    blocks: Array.from({ length: hexes }, (_, i) => ({
      x: x + i * step,
      width: step,
      dark: i % 2 === 0,
    })),
    height: size * 0.22,
    label: `${hexes * HEX_MILES} miles`,
  };
}
