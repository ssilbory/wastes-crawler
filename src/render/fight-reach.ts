// Who the acting combatant can strike right now (docs/presentation-plan.md, V3): each foe its
// weapons reach, in melee or only at range, read from the same targeting the attacks use
// (src/game/combat/targeting.ts, the Formation rules in docs/rules-adaptation.md). Read-only.
import { targets } from '../game/combat/targeting.ts';
import type { Battle, Combatant } from '../game/combat/types.ts';

export type Reach = 'melee' | 'ranged';

/** Each foe the actor can attack, by id: melee when any melee weapon reaches it. */
export function reachOf(b: Battle, actor: Combatant): Map<string, Reach> {
  const out = new Map<string, Reach>();
  for (const attack of actor.attacks)
    for (const t of targets(b, actor, attack))
      if (attack.mode === 'melee') out.set(t.id, 'melee');
      else if (!out.has(t.id)) out.set(t.id, 'ranged');
  return out;
}
