// The world's event bus (docs/plan.md, Quest: driven by an event bus from the game layer). The
// game layer emits what happened; listeners, the quests for now, react to it. The listeners are
// assembled in listeners.ts and reach emit through GameData, so no listener imports the others.
import type { GameData } from '../character/context.ts';
import { isCampaign } from './region.ts';
import type { Npc, World } from './types.ts';

export type WorldEvent =
  /** The party moved into the hex it now stands in. */
  | { kind: 'hex-entered' }
  | { kind: 'town-entered'; town: string }
  /** A won fight, the quest whose fixed encounter it was, the garrison post it held, and the
   * faction patrol it was (Phase 13b). */
  | { kind: 'fight-won'; quest: string | null; garrison: string | null; patrol?: string | null }
  | { kind: 'npc-died'; npc: Npc }
  /** A day has ended. */
  | { kind: 'day-passed' }
  /** Underground: the party reached a level, or stepped onto a cell (Phase 8c). */
  | { kind: 'level-entered' }
  | { kind: 'cell-entered' }
  /** A captive was freed into the party, or went their own way. */
  | { kind: 'captive-freed'; captive: string }
  /** A quest was turned in to its giver (Phase 12d). */
  | { kind: 'quest-done'; quest: string }
  /** A standing order ended, by countersign, token, quest, or its keeper's fall. */
  | { kind: 'order-ended'; order: string };

export type Listener = (w: World, data: GameData, e: WorldEvent) => void;

/** Every listener, in the order each event reaches them, and the campaign-only ones among them. */
export interface WorldListeners {
  all: readonly Listener[];
  campaign: ReadonlySet<Listener>;
}

export function emit(w: World, data: GameData, e: WorldEvent): void {
  const { listeners } = data;
  // A GameData built without the table would drop every event; built from untyped code it fails.
  if (!listeners) throw new Error('GameData has no world listeners (src/game/world/listeners.ts)');
  const story = isCampaign(w);
  for (const listen of listeners.all)
    if (story || !listeners.campaign.has(listen)) listen(w, data, e);
}
