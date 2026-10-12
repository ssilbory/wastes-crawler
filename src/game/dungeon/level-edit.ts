// The level editor's model (docs/decisions/0003-level-authoring.md): edits to the doubled ASCII
// grid, checked by the same validation as `pnpm validate:levels`, and written back as the same
// text, so hand-written and edited levels stay interchangeable.
import { dungeonReferenceErrors } from '../../data/dungeon-check.ts';
import type { CellKind, EdgeKind } from '../../data/dungeon-map.ts';
import {
  DungeonSchema,
  type ContentData,
  type Dungeon,
  type SrdData,
} from '../../data/schemas/index.ts';
import { settingReferenceErrors } from '../../data/setting-check.ts';
import type { Cell, Facing } from '../../rules/grid.ts';

const CELL_GLYPHS: Record<CellKind, string> = {
  floor: ' ',
  up: '<',
  down: '>',
  trap: 'T',
  npc: 'N',
};
const EDGE_GLYPHS: Record<Exclude<EdgeKind, 'wall'>, string> = {
  open: ' ',
  door: 'd',
  secret: 's',
};

const put = (rows: readonly string[], row: number, col: number, ch: string): string[] =>
  rows.map((r, i) => (i === row ? `${r.slice(0, col)}${ch}${r.slice(col + 1)}` : r));

/** A level of width × height cells, each one walled in. */
export function blankMap(width: number, height: number): string[] {
  const line = `+${'-+'.repeat(width)}`;
  const cells = `|${' |'.repeat(width)}`;
  return [line, ...Array.from({ length: height }, () => [cells, line]).flat()];
}

export function setCell(rows: readonly string[], c: Cell, kind: CellKind): string[] {
  return put(rows, 2 * c.y + 1, 2 * c.x + 1, CELL_GLYPHS[kind]);
}

/** Changes the edge on a cell's side; the outer border always stays a wall. */
export function setEdge(rows: readonly string[], c: Cell, side: Facing, kind: EdgeKind): string[] {
  const row = 2 * c.y + 1 + (side === 's' ? 1 : side === 'n' ? -1 : 0);
  const col = 2 * c.x + 1 + (side === 'e' ? 1 : side === 'w' ? -1 : 0);
  const height = rows.length;
  const width = (rows[0] as string).length;
  if (row <= 0 || col <= 0 || row >= height - 1 || col >= width - 1) return [...rows];
  const wall = side === 'n' || side === 's' ? '-' : '|';
  return put(rows, row, col, kind === 'wall' ? wall : EDGE_GLYPHS[kind]);
}

/** The dungeon with one level's map replaced. */
export function withLevelMap(d: Dungeon, levelId: string, rows: readonly string[]): Dungeon {
  return { ...d, levels: d.levels.map((l) => (l.id === levelId ? { ...l, map: [...rows] } : l)) };
}

/** The content's dungeons with the edited one in place, or added if it is new. */
const withDungeon = (content: ContentData, edited: Dungeon): Dungeon[] =>
  content.dungeons.some((d) => d.id === edited.id)
    ? content.dungeons.map((d) => (d.id === edited.id ? edited : d))
    : [...content.dungeons, edited];

/**
 * The dungeon's problems with the edits in place: its shape against the content schema, the level
 * validator, and, given the SRD, the garrison and special-square checks, so an export loads.
 */
export function editorErrors(content: ContentData, edited: Dungeon, srd?: SrdData): string[] {
  const dungeons = withDungeon(content, edited);
  const prefix = `dungeons/${edited.id}`;
  const parsed = DungeonSchema.safeParse(edited);
  const shape = parsed.success
    ? []
    : parsed.error.issues.map((i) => `${prefix}: ${i.path.join('.')}: ${i.message}`);
  const next = { ...content, dungeons };
  const setting = srd ? settingReferenceErrors(srd, next) : [];
  return [...shape, ...dungeonReferenceErrors(next), ...setting].filter((e) =>
    e.startsWith(prefix),
  );
}

/** data/content/dungeons.json with the edited dungeon in place, or added, ready to save over the file. */
export function exportDungeons(content: ContentData, edited: Dungeon): string {
  const dungeons = withDungeon(content, edited);
  return `${JSON.stringify(dungeons, null, 2)}\n`;
}
