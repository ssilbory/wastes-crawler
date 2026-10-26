// Who and what stands in the cells ahead (Sam's ask; docs/presentation-plan.md): a held captive
// among their guards, a garrison post's troops, a quest's guardians, and a quest item waiting to be
// taken, drawn standing in their cells with the fight screen's figures. They show until the
// captive is freed, the post beaten or its order ended, or the quest step done. Read-only.
import type { Cell } from '../rules/grid.ts';
import { cellKey } from '../rules/grid.ts';
import type { GameData } from '../game/character/context.ts';
import { captiveOf } from '../game/world/npcs.ts';
import { orderEnded } from '../game/world/orders.ts';
import { currentStep, questOf } from '../game/world/quests.ts';
import type { World } from '../game/world/types.ts';
import { ring, type Part } from './figure-art.ts';
import { monsterFigureOf, type FigureView } from './figure-view.ts';
import { flatOn, standIn } from './dungeon-geometry.ts';
import { shade, type Panel } from './dungeon-panel.ts';
import { levelOf } from '../game/dungeon/levels.ts';

export interface Occupant {
  kind: 'captive' | 'garrison' | 'guardian' | 'item';
  /** What it is, for a tooltip. */
  title: string;
  /** The figures, the captive among their guards; none for an item. */
  figures: { figure: FigureView; foe: boolean }[];
}

/** The most figures one cell shows; the rest of a group stands behind them. */
export const CELL_SHOWN = 3;

// Schemas give every guard and enemy group at least one row.
const foes = (rows: readonly string[][], data: GameData) =>
  (rows[0] as string[])
    .slice(0, CELL_SHOWN)
    .map((id) => ({ figure: monsterFigureOf(data, id), foe: true }));

/** What stands on each cell of the party's level, by cell key. */
export function occupantsOf(w: World, data: GameData): Map<string, Occupant> {
  const out = new Map<string, Occupant>();
  const s = w.dungeon;
  if (!s) return out;
  const { level } = levelOf(data, s.dungeon, s.level);
  const place = `${s.dungeon}/${s.level}`;
  for (const h of level.captives) {
    if (w.rescues.includes(`${place}/${cellKey(h.at)}`)) continue;
    const c = captiveOf(data, h.captive);
    const guards = foes(h.guards, data).slice(0, CELL_SHOWN - 1);
    const captive = { figure: monsterFigureOf(data, c.monster), foe: false };
    out.set(cellKey(h.at), {
      kind: 'captive',
      title: `${c.name}, held by guards`,
      // The captive stands in the middle of their guards.
      figures: [...guards.slice(0, 1), captive, ...guards.slice(1)],
    });
  }
  for (const p of level.garrisons) {
    if (orderEnded(w, p.order) || w.beaten.includes(`${place}/${cellKey(p.at)}`)) continue;
    out.set(cellKey(p.at), {
      kind: 'garrison',
      title: 'A garrison post',
      figures: foes(p.enemies, data),
    });
  }
  for (const [id, st] of Object.entries(w.quests)) {
    const o = st.status === 'active' ? currentStep(w, data, id) : undefined;
    if (!o || !('at' in o) || !('dungeon' in o) || `${o.dungeon}/${o.level}` !== place) continue;
    const name = questOf(data, id).name;
    if (o.kind === 'guardian')
      out.set(cellKey(o.at), { kind: 'guardian', title: name, figures: foes(o.enemies, data) });
    else out.set(cellKey(o.at), { kind: 'item', title: `${o.item} (${name})`, figures: [] });
  }
  return out;
}

/** A quest item: a small chest, its lock glinting in the light. */
export const CHEST: Part[] = [
  { kind: 'fill', d: 'M14,34.6H34V46H14Z' },
  { kind: 'fill', d: 'M13,31Q24,24.4 35,31V34.6H13Z' },
  { kind: 'cut', d: 'M14,34.6H34M18,31V46M30,31V46', width: 0.8 },
  { kind: 'fill', d: ring(24, 37.4, 1.4), tone: 'flame' },
];

/** A figure or the chest, placed in its 48-unit box in view pixels. */
export interface Placed {
  figure: FigureView | null;
  foe: boolean;
  x: number;
  y: number;
  size: number;
}

/** Where each of an occupant's pieces stands in its cell: side by side, a little apart. */
export function placeIn(o: Occupant, depth: number, lateral: number): Placed[] {
  const cell = standIn(depth + 0.5, lateral);
  const feet = cell.y + (cell.size * 46) / 48;
  if (o.figures.length === 0) {
    const size = cell.size * 0.6;
    return [
      {
        figure: null,
        foe: false,
        x: cell.x + (cell.size - size) / 2,
        y: feet - (size * 46) / 48,
        size,
      },
    ];
  }
  const n = o.figures.length;
  const size = cell.size * (n === 1 ? 0.9 : 0.72);
  return o.figures.map((f, i) => {
    const cx = cell.x + cell.size * (n === 1 ? 0.5 : 0.22 + (0.56 * i) / (n - 1));
    return { ...f, x: cx - size / 2, y: feet - (size * 46) / 48, size };
  });
}

/** The occupant of a cell, if any, for the view. */
export type OccupantAt = (c: Cell) => Occupant | null;

/** The panel for a cell's occupant, shaded like the stone it stands among. */
export function occupantPanel(o: Occupant, depth: number, lateral: number): Panel {
  const pieces = placeIn(o, depth, lateral);
  const box = standIn(depth + 0.5, lateral);
  return {
    key: `occupant-${depth}-${lateral}`,
    kind: 'occupant',
    points: '',
    frame: null,
    fill: shade('wall', depth, false),
    detail: { lines: '', patches: '' },
    breach: null,
    trap: null,
    leaf: null,
    occupant: { kind: o.kind, title: o.title, pieces },
    span: flatOn(depth + 0.5, [
      [box.x, box.y],
      [box.x + box.size, box.y],
      [box.x + box.size, box.y + box.size],
      [box.x, box.y + box.size],
    ]),
  };
}
