// The world's event bus (docs/plan.md, Quest: driven by an event bus from the game layer). The
// game layer emits what happened; listeners, the quests for now, react to it.
import type { GameData } from '../character/context.ts';
import { questListener } from './quests.ts';
import { raisingListener } from './raising.ts';
import { rescueListener } from '../dungeon/rescues.ts';
import type { Npc, World } from './types.ts';

export type WorldEvent =
  /** The party moved into the hex it now stands in. */
  | { kind: 'hex-entered' }
  | { kind: 'town-entered'; town: string }
  /** A won fight, and the quest whose fixed encounter it was. */
  | { kind: 'fight-won'; quest: string | null }
  | { kind: 'npc-died'; npc: Npc }
  /** A day has ended. */
  | { kind: 'day-passed' }
  /** Underground: the party reached a level, or stepped onto a cell (Phase 8c). */
  | { kind: 'level-entered' }
  | { kind: 'cell-entered' }
  /** A captive was freed into the party, or went their own way. */
  | { kind: 'captive-freed'; captive: string };

type Listener = (w: World, data: GameData, e: WorldEvent) => void;

const LISTENERS: readonly Listener[] = [questListener, rescueListener, raisingListener];

export function emit(w: World, data: GameData, e: WorldEvent): void {
  for (const listen of LISTENERS) listen(w, data, e);
}
