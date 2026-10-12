// The world's event bus (docs/plan.md, Quest: driven by an event bus from the game layer). The
// game layer emits what happened; listeners, the quests for now, react to it.
import type { GameData } from '../character/context.ts';
import { clockListener } from './clock.ts';
import { craftingListener } from './crafting.ts';
import { grovesListener } from './groves.ts';
import { factionsListener } from '../factions/turn.ts';
import { maintenanceListener } from './maintenance.ts';
import { notesListener } from './notes.ts';
import { sharesListener } from './shares.ts';
import { ordersListener } from './orders.ts';
import { questListener } from './quests.ts';
import { raidsListener } from './raids.ts';
import { raisingListener } from './raising.ts';
import { rescueListener } from '../dungeon/rescues.ts';
import { ruinsListener } from '../dungeon/ruins.ts';
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
  | { kind: 'quest-done'; quest: string };

type Listener = (w: World, data: GameData, e: WorldEvent) => void;

const LISTENERS: readonly Listener[] = [
  questListener,
  grovesListener,
  rescueListener,
  raisingListener,
  craftingListener,
  maintenanceListener,
  ordersListener,
  raidsListener,
  factionsListener,
  clockListener,
  notesListener,
  sharesListener,
  ruinsListener,
];

/**
 * The campaign's own story: its standing orders, raids, factions, warlord's clock, and crafter's
 * notes, all tied to the shipped towns. A world on a custom map has none of it (Sam's call).
 */
const CAMPAIGN: ReadonlySet<Listener> = new Set([
  ordersListener,
  raidsListener,
  factionsListener,
  clockListener,
  notesListener,
]);

export function emit(w: World, data: GameData, e: WorldEvent): void {
  for (const listen of LISTENERS) if (w.map === null || !CAMPAIGN.has(listen)) listen(w, data, e);
}
