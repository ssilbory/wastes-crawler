// The foes of a pending encounter as they stand in the corridor ahead (docs/presentation-plan.md,
// V4): their silhouettes over the first-person view, the front row two cells ahead (clear of the
// encounter panel over the foot of the view) and each row behind smaller and higher, as the view's
// perspective puts them. Read-only drawing data; the figures are
// those of the fight screen (figure-view.ts).
import type { GameData } from '../game/character/context.ts';
import { VIEW_HEIGHT, VIEW_WIDTH } from './dungeon-geometry.ts';
import { lightFrom, type Relief } from './figure-draw.ts';
import { monsterFigureOf, type FigureView } from './figure-view.ts';

export interface PortraitFigure {
  key: string;
  figure: FigureView;
  /** The figure's 48-unit box in view pixels. */
  x: number;
  y: number;
  size: number;
  /** Cells from the party, for how dark the light leaves it. */
  depth: number;
  /** Which edge catches the party's light (figure-draw.ts). */
  light: Relief;
}

/** The most figures one row shows; a crowd stands behind its first few. */
export const ROW_SHOWN = 5;

/** Each row's box size and the line its feet stand on, front row first. */
const ROWS = [
  { size: 84, feet: VIEW_HEIGHT - 74 },
  { size: 62, feet: VIEW_HEIGHT - 88 },
  { size: 46, feet: VIEW_HEIGHT - 98 },
];

/** Back rows first, so the front row stands in front of them. */
export function encounterPortrait(data: GameData, enemies: readonly string[][]): PortraitFigure[] {
  return enemies
    .slice(0, ROWS.length)
    .flatMap((row, r) => {
      const { size, feet } = ROWS[r] as (typeof ROWS)[number];
      const shown = row.slice(0, ROW_SHOWN);
      // Spread across the corridor, closer together the further back they stand.
      const span = VIEW_WIDTH * (0.72 - r * 0.16);
      return shown.map((id, i) => {
        const cx = VIEW_WIDTH / 2 + span * ((i + 1) / (shown.length + 1) - 0.5);
        return {
          key: `${r}-${i}`,
          figure: monsterFigureOf(data, id),
          x: cx - size / 2,
          // The figure stands on y = 46 of its 48-unit box.
          y: feet - (size * 46) / 48,
          size,
          depth: r + 2,
          light: lightFrom(cx),
        };
      });
    })
    .reverse();
}
