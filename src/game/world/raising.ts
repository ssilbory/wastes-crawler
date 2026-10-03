// Raising quests (docs/rules-adaptation.md, Raising quests; Sam's call). A temple priest's quests
// are ordinary quests whose only reward is a free raising of one dead PC. While a PC is dead,
// coming into a town draws one of its priest's raising quests at random as the offer, and the
// party can take one at most once a month, counted from the day it was last taken.
import type { Quest } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import { giverName, questOf } from './quests.ts';
import type { World } from './types.ts';

export const isRaising = (q: Quest) => q.reward.raise === true;

export const anyDead = (w: World) => w.members.some((m) => m.dead);

/** A raising quest under way or waiting to be turned in. */
const raisingTaken = (w: World, data: GameData) =>
  Object.entries(w.quests).some(
    ([id, st]) => (st.status === 'active' || st.status === 'ready') && isRaising(questOf(data, id)),
  );

/** Draws a raising quest from the town's priests, unless one stands on offer here already. */
export function offerRaising(w: World, data: GameData, town: string): void {
  const givers = new Set(
    data.content.missionGivers.filter((g) => g.town === town).map((g) => g.id),
  );
  const pool = data.content.quests.filter((q) => isRaising(q) && givers.has(q.giver));
  if (pool.some((q) => q.id === w.raising.offer)) return;
  const month = data.content.overlandRules.daysPerMonth;
  const due = w.raising.accepted === null || w.day - w.raising.accepted >= month;
  if (pool.length === 0 || !due || !anyDead(w) || raisingTaken(w, data)) return;
  const q = pool[w.rng.int(0, pool.length - 1)] as Quest;
  w.raising.offer = q.id;
  note(w, `${giverName(data, q)} has work that would raise the dead: ${q.name}.`);
}

/** Why a raising quest can't be taken now, or null. */
export function raisingBlocked(w: World, q: Quest): string | null {
  if (w.raising.offer !== q.id) return 'Not on offer.';
  if (!anyDead(w)) return 'No one in the party is dead.';
  return null;
}

/** The raising quests' bus listener. */
export function raisingListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'town-entered') offerRaising(w, data, e.town);
}
