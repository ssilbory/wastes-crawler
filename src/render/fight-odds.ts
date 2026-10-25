// The odds the fight screen shows before an attack (docs/presentation-plan.md, V3): the chance to
// hit, the damage a hit can do, and the Shock a miss still deals. Read from the same roll input
// and Shock rules the attack uses (src/game/combat/attack.ts, src/rules/attacks.ts); nothing here
// rolls or changes the battle. Resistances, wards, and walls aren't counted, so a blow can still
// come out lower than the range.
import { attackInput, hitShockContext, shockContext } from '../game/combat/attack.ts';
import { blastAttribute, blastInput } from '../game/combat/blast.ts';
import type { Action, Battle, Combatant } from '../game/combat/types.ts';
import { hitChance, shockDamage, type ShockContext } from '../rules/attacks.ts';

export interface AttackOdds {
  /** From 0 to 1. */
  chance: number;
  /** The least and most a hit can do. */
  min: number;
  max: number;
  /** What a miss still deals, 0 for none. */
  shock: number;
}

type AttackAction = Extract<Action, { kind: 'attack' }>;

/** Smite the Wicked's edge, when the attack spends it: to hit, and the level added on a hit. */
function smiteEdge(b: Battle, actor: Combatant): { hit: number; damage: number } {
  const m = b.data.content.combatMagic.find((x) => x.effect.kind === 'smite-wicked');
  const hit = m?.effect.kind === 'smite-wicked' ? m.effect.hit : 0;
  return { hit, damage: actor.caster?.level ?? 0 };
}

export function attackOdds(b: Battle, actor: Combatant, action: AttackAction): AttackOdds | null {
  const attack = actor.attacks[action.attack];
  const target = b.combatants.find((c) => c.id === action.target);
  if (!attack || !target) return null;
  const smite = action.smite ? smiteEdge(b, actor) : { hit: 0, damage: 0 };
  const blessed = actor.blessed;
  const shockOf = (ctx: ShockContext) =>
    attack.mode === 'melee' ? shockDamage(attack.shock, 0, blessed, ctx) : 0;
  const shock = shockOf(shockContext(target, attack));
  // A ready shield would have soaked the miss's Shock, so a hit isn't raised to it (attack.ts).
  const floor = shockOf(hitShockContext(target, attack));
  const d = attack.damage;
  const bonus = d.modifier + attack.damageBonus + blessed + actor.flame;
  // Call of the Tomb: every blow lands on the doomed, for the most its dice can do (4.6.0).
  if (target.doomedUntil >= b.round) {
    const most = d.count * d.sides + bonus + smite.damage;
    return { chance: 1, min: most, max: most, shock };
  }
  const input = attackInput(b, actor, attack, target, smite.hit + actor.nextHitBonus);
  return {
    chance: hitChance(input),
    // A hit never does less than the Shock the same blow deals on a miss (2.4.6.4).
    min: Math.max(floor, Math.max(0, d.count + bonus)) + smite.damage,
    max: Math.max(floor, Math.max(0, d.count * d.sides + bonus)) + smite.damage,
    shock,
  };
}

/** Elemental Blast's odds: its own roll, and dice plus the level and the attribute; no Shock. */
export function blastOdds(
  b: Battle,
  actor: Combatant,
  action: Extract<Action, { kind: 'cast' }>,
): AttackOdds | null {
  const m = b.data.content.combatMagic.find((x) => x.id === action.magic);
  const target = b.combatants.find((c) => c.id === action.target);
  if (m?.effect.kind !== 'blast' || !target || !actor.caster) return null;
  const { level } = actor.caster;
  const d = m.effect.damage;
  const bonus = d.modifier + level + blastAttribute(actor, m.effect);
  return {
    chance: hitChance(blastInput(b, actor, m.effect, target, level)),
    min: Math.max(0, d.count + bonus),
    max: Math.max(0, d.count * d.sides + bonus),
    shock: 0,
  };
}

const percent = (p: number) => `${Math.round(p * 100)}%`;

/** "55% to hit, 3–10 damage, 2 Shock on a miss", or null for an action that isn't an attack. */
export function oddsText(b: Battle, actor: Combatant, action: Action): string | null {
  const odds =
    action.kind === 'attack'
      ? attackOdds(b, actor, action)
      : action.kind === 'cast'
        ? blastOdds(b, actor, action)
        : null;
  if (!odds) return null;
  const damage = odds.min === odds.max ? `${odds.min}` : `${odds.min}–${odds.max}`;
  const shock = odds.shock > 0 ? `, ${odds.shock} Shock on a miss` : '';
  return `${percent(odds.chance)} to hit, ${damage} damage${shock}`;
}
