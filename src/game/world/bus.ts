// The world's event bus (docs/plan.md, Quest: driven by an event bus from the game layer). The
// game layer emits what happened; listeners, the quests for now, react to it.
import type { GameData } from '../character/context.ts';
import { questListener } from './quests.ts';
import type { Npc, World } from './types.ts';

export type WorldEvent =
  /** The party moved into the hex it now stands in. */
  | { kind: 'hex-entered' }
  | { kind: 'town-entered'; town: string }
  /** A won fight, and the quest whose fixed encounter it was. */
  | { kind: 'fight-won'; quest: string | null }
  | { kind: 'npc-died'; npc: Npc }
  /** A day has ended. */
  | { kind: 'day-passed' };

type Listener = (w: World, data: GameData, e: WorldEvent) => void;

const LISTENERS: readonly Listener[] = [questListener];

export function emit(w: World, data: GameData, e: WorldEvent): void {
  for (const listen of LISTENERS) listen(w, data, e);
}
