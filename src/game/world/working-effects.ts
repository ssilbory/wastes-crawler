// What standing Workings do (docs/rules-adaptation.md, Major projects: Workings; Phase 22d): each
// finished Working's effect at its settlement, sized by its content's `amount`. Reads only, so the
// raids, coaches, water, workshops, and projects can ask without importing the Workings' game.
import type { Working } from '../../data/schemas/project-content.ts';
import type { GameData } from '../character/context.ts';
import type { World } from './types.ts';

type Effect = Working['effect'];

/** The finished Workings with this effect, each with its settlement and size. */
export function standingWorkings(
  w: World,
  data: GameData,
  effect: Effect,
): { town: string; amount: number }[] {
  return w.workings.flatMap((s) => {
    const def = data.content.projects.workings.find((x) => x.id === s.working);
    return s.done !== null && def?.effect === effect ? [{ town: s.town, amount: def.amount }] : [];
  });
}

/** The sum of a Working effect's sizes at one settlement. */
export const workingAt = (w: World, data: GameData, effect: Effect, town: string) =>
  standingWorkings(w, data, effect)
    .filter((x) => x.town === town)
    .reduce((sum, x) => sum + x.amount, 0);
