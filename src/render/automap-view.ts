// Read-only drawing data for the dungeon automap: the cells the party has seen on this level, their
// walls and doors, and an arrow for the party. Secret doors draw as walls until found, and traps
// as floor until known.
import { levelOf } from '../game/dungeon/explore.ts';
import { knownEdges } from '../game/dungeon/secrets.ts';
import type { GameData } from '../game/character/context.ts';
import type { World } from '../game/world/types.ts';
import { FACINGS, type Facing } from '../rules/grid.ts';
import type { CellKind } from '../data/dungeon-map.ts';

export const MAP_CELL = 16;

export interface AutomapCell {
  key: string;
  x: number;
  y: number;
  kind: CellKind;
}

export interface AutomapLine {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  kind: 'wall' | 'door';
}

export interface Automap {
  width: number;
  height: number;
  cells: AutomapCell[];
  lines: AutomapLine[];
  /** Magical squares sensed with Apprehending the Arcane Form. */
  sensed: { key: string; x: number; y: number }[];
  /** The party's arrow as SVG polygon points. */
  party: string;
}

export const FACING_NAMES: Record<Facing, string> = {
  n: 'north',
  e: 'east',
  s: 'south',
  w: 'west',
};

/** The two ends of a cell's edge, in pixels. */
function edgeLine(
  x: number,
  y: number,
  side: Facing,
  size: number,
): [number, number, number, number] {
  const [l, t, r, b] = [x * size, y * size, (x + 1) * size, (y + 1) * size];
  if (side === 'n') return [l, t, r, t];
  if (side === 's') return [l, b, r, b];
  if (side === 'w') return [l, t, l, b];
  return [r, t, r, b];
}

/** An arrow in the middle of a cell, pointing the way the party faces. */
function arrow(x: number, y: number, f: Facing, size: number): string {
  const [cx, cy, r] = [(x + 0.5) * size, (y + 0.5) * size, size * 0.35];
  const turns = FACINGS.indexOf(f);
  const tip: [number, number][] = [
    [0, -r],
    [r * 0.8, r],
    [-r * 0.8, r],
  ];
  return tip
    .map(([dx, dy]) => {
      // Quarter turns clockwise: (dx, dy) -> (-dy, dx).
      let [px, py] = [dx, dy];
      for (let i = 0; i < turns; i++) [px, py] = [-py, px];
      return `${(cx + px).toFixed(1)},${(cy + py).toFixed(1)}`;
    })
    .join(' ');
}

export function automap(w: World, data: GameData, size = MAP_CELL): Automap | null {
  const s = w.dungeon;
  if (!s) return null;
  const { map } = levelOf(data, s.dungeon, s.level);
  const edge = knownEdges(w, data);
  const cells: AutomapCell[] = [];
  const lines = new Map<string, AutomapLine>();
  for (const key of s.seen[s.level] ?? []) {
    const [x, y] = key.split(',').map(Number) as [number, number];
    const cell = map.cell({ x, y });
    // Traps show once known, and secret doors once found; until then they look like the rest.
    const known = s.traps[s.level]?.[key] !== undefined;
    cells.push({ key, x, y, kind: cell === 'trap' && !known ? 'floor' : cell });
    for (const side of FACINGS) {
      const e = edge({ x, y }, side);
      if (e === 'open') continue;
      const [x1, y1, x2, y2] = edgeLine(x, y, side, size);
      const id = `${x1},${y1},${x2},${y2}`;
      lines.set(id, { key: id, x1, y1, x2, y2, kind: e === 'door' ? 'door' : 'wall' });
    }
  }
  return {
    width: map.width * size,
    height: map.height * size,
    cells,
    lines: [...lines.values()],
    sensed: (s.sensed[s.level] ?? []).map((key) => {
      const [x, y] = key.split(',').map(Number) as [number, number];
      return { key, x, y };
    }),
    party: arrow(s.at.x, s.at.y, s.facing, size),
  };
}

/** A dungeon cell is 10 feet across (docs/rules-adaptation.md, Dungeon exploration: Turns). */
export const CELL_FEET = 10;

/** Height of the strip under the map that holds its scale and compass. */
export const LEGEND_HEIGHT = 22;

/**
 * The automap's legend, in the strip under the map (docs/presentation-plan.md, V4): a scale bar of
 * alternating cell-long blocks, up to five, labelled in feet, and a compass rose at the right. The
 * map is always drawn north up.
 */
export interface AutomapLegend {
  blocks: { x: number; width: number; dark: boolean }[];
  /** Where the bar sits, and its label. */
  y: number;
  label: string;
  compass: { x: number; y: number };
}

export function automapLegend(
  map: Pick<Automap, 'width' | 'height'>,
  size = MAP_CELL,
): AutomapLegend {
  const cells = Math.max(1, Math.min(5, Math.floor(map.width / size) - 3));
  return {
    blocks: Array.from({ length: cells }, (_, i) => ({
      x: i * size,
      width: size,
      dark: i % 2 === 0,
    })),
    y: map.height + 12,
    label: `${cells * CELL_FEET} feet`,
    compass: { x: map.width - 8, y: map.height + LEGEND_HEIGHT / 2 + 1 },
  };
}
