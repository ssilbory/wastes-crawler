// Text and map marks for quests. Pure reads of game state.
import type { Dungeon, Quest } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import { currentStep, questOf } from '../game/world/quests.ts';
import type { World } from '../game/world/types.ts';
import type { Hex } from '../rules/hex.ts';

/** Hexes on the party's map where an active quest's current step waits. */
export function questTargets(w: World, data: GameData): Hex[] {
  return Object.entries(w.quests).flatMap(([id, st]) => {
    if (st.status !== 'active') return [];
    const o = currentStep(w, data, id);
    if (!o) return [];
    if (o.kind === 'slay' || o.kind === 'scout') return o.region === w.region ? [o.hex] : [];
    if (!('dungeon' in o)) return [];
    // A delve step marks its dungeon's entrance; content checks guarantee the dungeon.
    const d = data.content.dungeons.find((x) => x.id === o.dungeon) as Dungeon;
    return d.region === w.region ? [d.entrance] : [];
  });
}

/** "60 crowns, 3 XP, 2d6 loot", or a raising quest's free raising. */
export function rewardText(q: Quest): string {
  if (q.reward.raise) return 'one dead PC raised';
  const loot = q.reward.loot.map((d) => `${d.count}d${d.sides}`).join(' + ');
  return [`${q.reward.crowns} crowns`, `${q.reward.xp} XP`, loot && `${loot} loot`]
    .filter(Boolean)
    .join(', ');
}

/** Where a taken quest stands: its current step, or what's left to do. */
export function questStatus(w: World, data: GameData, id: string): string {
  const st = w.quests[id];
  if (!st) return 'Not taken.';
  const q = questOf(data, id);
  if (st.status === 'done') return 'Done.';
  if (st.status === 'failed') return 'Failed.';
  if (st.status === 'ready') return 'Done: return for the reward.';
  const left =
    q.deadlineDays === undefined ? '' : ` ${q.deadlineDays - (w.day - st.acceptedDay)} days left.`;
  return `${currentStep(w, data, id)?.text ?? ''}${left}`;
}
