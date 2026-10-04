// The warlord's clock (docs/rules-adaptation.md, Warlord's clock in Phase 12d; Sam's call: pressure
// with no fail state). It ticks a segment as each month begins and when crafter's notes are sold;
// the quests and rescues the campaign names, and burned notes, knock it back. Each full tier adds
// warlord patrols to the encounter tables and a beastman to the warlord's last fight.
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import type { World } from './types.ts';

const MAX_PER_ROW = 8;

const rules = (data: GameData) => data.content.campaign.clock;

/** Full tiers of the clock. */
export const clockTier = (w: World, data: GameData) => Math.floor(w.clock / rules(data).perTier);

/** Moves the clock by `by` segments, within its bounds, and says why. */
export function moveClock(w: World, data: GameData, by: number, why: string): void {
  const next = Math.max(0, Math.min(rules(data).segments, w.clock + by));
  if (next === w.clock) return;
  const tier = clockTier(w, data);
  w.clock = next;
  note(
    w,
    `${why} The warlord's clock ${by > 0 ? 'advances' : 'falls back'} to ${next} of ${rules(data).segments}.`,
  );
  if (clockTier(w, data) > tier) note(w, "The warlord's patrols grow bolder.");
}

/** A guardian's enemies, with one more of `reinforce` in the front row per tier of the clock. */
export function reinforced(
  w: World,
  data: GameData,
  enemies: string[][],
  reinforce: string | undefined,
): string[][] {
  if (!reinforce) return enemies;
  const [front = [], ...rest] = enemies;
  const extra = Math.min(clockTier(w, data), MAX_PER_ROW - front.length);
  return [[...front, ...Array<string>(Math.max(0, extra)).fill(reinforce)], ...rest];
}

/** The clock's bus listener. */
export function clockListener(w: World, data: GameData, e: WorldEvent): void {
  const { knockback } = rules(data);
  if (e.kind === 'day-passed' && (w.day + 1) % data.content.overlandRules.daysPerMonth === 0)
    moveClock(w, data, 1, 'A month turns, and the warlord breeds more troops.');
  else if (e.kind === 'quest-done' && knockback.quests.includes(e.quest))
    moveClock(w, data, -1, 'The warlord feels the loss.');
  else if (e.kind === 'captive-freed' && knockback.captives.includes(e.captive))
    moveClock(w, data, -1, 'The warlord has one crafter fewer.');
}
