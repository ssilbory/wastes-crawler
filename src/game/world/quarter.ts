// One quarter day on the overland map (docs/rules-adaptation.md, Overland travel): the party hikes
// or camps, then the wandering encounter checks; time moves on once any encounter is settled.
import type { BattleResult } from '../combat/battle.ts';
import { isDark } from '../../rules/overland.ts';
import type { GameData } from '../character/context.ts';
import { camp, hike } from './activities.ts';
import { dateOf, quarterName } from './calendar.ts';
import { endOfDay } from './day.ts';
import { leaveEncounter, maybeEncounter } from './encounters.ts';
import type { Difficulty } from './difficulty.ts';
import { applyBattle, type WorldBattle } from './fight.ts';
import { alive } from './members.ts';
import type { QuarterPlan, World } from './types.ts';

export function isDarkNow(w: World, data: GameData): boolean {
  return isDark(quarterName(w.quarter), dateOf(data.content.overlandRules, w.day).season);
}

function endQuarter(w: World, data: GameData): void {
  if (w.quarter < 3) {
    w.quarter += 1;
    return;
  }
  endOfDay(w, data);
  w.day += 1;
  w.quarter = 0;
}

/** Plays a quarter; returns false if an encounter must be settled first. */
export function passQuarter(w: World, data: GameData, plan: QuarterPlan): boolean {
  if (w.encounter) return false;
  const dark = isDarkNow(w, data);
  let extra: number;
  let watcher;
  if (plan.kind === 'hike') {
    extra = hike(w, data, plan.leader, dark);
    watcher = alive(w).find((m) => m.id === plan.watcher);
  } else ({ extraChecks: extra, watcher } = camp(w, data, plan.activities));
  for (let i = 0; i <= extra; i++) if (maybeEncounter(w, data, watcher, dark)) return true;
  endQuarter(w, data);
  return true;
}

/** Avoids or lets pass the pending encounter, then finishes the quarter. */
export function settleByLeaving(w: World, data: GameData): boolean {
  if (!leaveEncounter(w)) return false;
  endQuarter(w, data);
  return true;
}

/** Applies a finished fight, then finishes the quarter unless the party fell. */
export function settleByFighting(
  w: World,
  data: GameData,
  fight: WorldBattle,
  result: BattleResult,
  difficulty: Difficulty | null,
): void {
  applyBattle(w, data, fight, result, difficulty);
  if (result.outcome !== 'enemy') endQuarter(w, data);
}
