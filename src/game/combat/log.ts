// The battle log, kept apart so every combat module can write to it without import cycles.
import type { Battle, BattleEvent, Combatant } from './types.ts';

export function say(b: Battle, text: string): void {
  b.log?.push(`Round ${b.round}: ${text}`);
  // Whose turn the line came in, for the log's filters (docs/presentation-plan.md, V3).
  b.logSides?.push(b.acting);
}

/** Records a blow for the fight screen's numbers (docs/presentation-plan.md, V3), with the log. */
export const recordBlow = (
  b: Battle,
  kind: BattleEvent['kind'],
  actor: Combatant,
  target: Combatant,
  amount = 0,
) => b.events?.push({ kind, actor: actor.id, target: target.id, amount });
