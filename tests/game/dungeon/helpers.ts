import { enterDungeon } from '../../../src/game/dungeon/explore.ts';
import type { Facing } from '../../../src/rules/grid.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, world } from '../world/helpers.ts';

/** The four starters at the barrow's entry, a torch lit. */
export function below(): World {
  const w = world();
  w.position = { col: 5, row: 10 };
  enterDungeon(w, data);
  return w;
}

/** Puts the party on a cell, as if it had walked there. */
export function place(w: World, level: string, x: number, y: number, facing: Facing): World {
  Object.assign(w.dungeon as NonNullable<World['dungeon']>, { level, at: { x, y }, facing });
  return w;
}

export const state = (w: World) => w.dungeon as NonNullable<World['dungeon']>;
