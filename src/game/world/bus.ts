// The world's event bus (docs/plan.md, Quest: driven by an event bus from the game layer). The
// game layer emits what happened; listeners, the quests for now, react to it. The listeners are
// assembled in listeners.ts and reach emit through GameData, so no listener imports the others.
import type { SiegeFight } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { hasFactions, hasProjects, isCampaign } from './region.ts';
import type { Npc, World } from './types.ts';

export type WorldEvent =
  /** The party moved into the hex it now stands in. */
  | { kind: 'hex-entered' }
  | { kind: 'town-entered'; town: string }
  /** A won fight, the quest whose fixed encounter it was, the garrison post it held, and the
   * faction patrol it was (Phase 13b). */
  | {
      kind: 'fight-won';
      quest: string | null;
      garrison: string | null;
      patrol?: string | null;
      /** The part of a siege it was (Phase 23a). */
      siege?: SiegeFight | null;
    }
  /** A fight the party came out of, won or broken off, and the part of a siege it was. */
  | { kind: 'fight-over'; won: boolean; siege: SiegeFight | null }
  | { kind: 'npc-died'; npc: Npc }
  /** A day has ended. */
  | { kind: 'day-passed' }
  /** Underground: the party reached a level, or stepped onto a cell (Phase 8c). */
  | { kind: 'level-entered' }
  | { kind: 'cell-entered' }
  /** A captive was freed into the party, or went their own way. */
  | { kind: 'captive-freed'; captive: string }
  /** A freed captive reached the town they were bound for (Phase 22: Renown). */
  | { kind: 'captive-home'; captive: string }
  /** A quest was turned in to its giver (Phase 12d). */
  | { kind: 'quest-done'; quest: string }
  /** One of the ally's held settlements freed, with or without the party's part (Phase 23e). */
  | { kind: 'town-freed'; town: string; party: boolean }
  /** A standing order ended, by countersign, token, quest, or its keeper's fall. */
  | { kind: 'order-ended'; order: string };

export type Listener = (w: World, data: GameData, e: WorldEvent) => void;

/**
 * Every listener, in the order each event reaches them, the campaign-only ones among them, those
 * that run wherever the world has factions (the campaign, or a realm with an ally), and those that
 * run wherever the party can build (the campaign, or a realm that allows projects).
 */
export interface WorldListeners {
  all: readonly Listener[];
  campaign: ReadonlySet<Listener>;
  factions?: ReadonlySet<Listener>;
  projects?: ReadonlySet<Listener>;
}

export function emit(w: World, data: GameData, e: WorldEvent): void {
  const { listeners } = data;
  // A GameData built without the table would drop every event; built from untyped code it fails.
  if (!listeners) throw new Error('GameData has no world listeners (src/game/world/listeners.ts)');
  const story = isCampaign(w);
  const factions = hasFactions(w, data);
  const projects = hasProjects(w, data);
  const runs = (listen: Listener) =>
    story ||
    (listeners.factions?.has(listen)
      ? factions
      : listeners.projects?.has(listen)
        ? projects
        : !listeners.campaign.has(listen));
  for (const listen of listeners.all) if (runs(listen)) listen(w, data, e);
}
