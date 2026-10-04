// The level editor's test walk (Sam's call): walking an edited dungeon's geometry in first person,
// with no party, light, time, traps, or encounters. Secret doors are open to the author, and stairs
// follow the level's links.
import { parseLevelMap, type LevelMap } from '../../data/dungeon-map.ts';
import type { Dungeon } from '../../data/schemas/index.ts';
import { ahead, turn, type Cell, type Facing } from '../../rules/grid.ts';

export interface Walk {
  level: string;
  at: Cell;
  facing: Facing;
}

/** The parsed map of one of the dungeon's levels, or null while it doesn't parse. */
export function walkMap(d: Dungeon, level: string): LevelMap | null {
  const parsed = parseLevelMap(d.levels.find((l) => l.id === level)?.map ?? []);
  return parsed.ok ? parsed.map : null;
}

/** Where a walk starts on a level: the dungeon's entry, or the first stairs arriving there. */
export function startWalk(d: Dungeon, level: string): Walk {
  if (d.entry.level === level) return { level, at: d.entry.at, facing: d.entry.facing };
  for (const l of d.levels)
    for (const link of l.links)
      if ('level' in link.to && link.to.level === level)
        return { level, at: link.to.at, facing: link.to.facing };
  return { level, at: { x: 0, y: 0 }, facing: 'n' };
}

export type WalkStep = 'forward' | 'back' | 'left' | 'right';

/** One step, or null if a wall is in the way. */
export function walkStep(map: LevelMap, w: Walk, dir: WalkStep): Walk | null {
  const way =
    dir === 'forward' ? w.facing : dir === 'back' ? turn(w.facing, 'around') : turn(w.facing, dir);
  if (!map.inBounds(w.at) || map.edge(w.at, way) === 'wall') return null;
  return { ...w, at: ahead(w.at, way) };
}

export const walkTurn = (w: Walk, by: 'left' | 'right') => ({ ...w, facing: turn(w.facing, by) });

/** Takes the stairs underfoot to another level, or null if there are none that go there. */
export function walkStairs(d: Dungeon, w: Walk): Walk | null {
  const link = d.levels
    .find((l) => l.id === w.level)
    ?.links.find((l) => l.at.x === w.at.x && l.at.y === w.at.y);
  if (!link || !('level' in link.to)) return null;
  return { level: link.to.level, at: link.to.at, facing: link.to.facing };
}
