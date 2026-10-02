// vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md (2.4.5 attack rolls, 2.4.6 damage, 2.4.6.4 Shock)
import type { Dice } from '../data/schemas/index.ts';
import { rollD20WithEdge, type D20Roll } from './advantage.ts';
import { roll } from './dice.ts';
import type { Rng } from './rng.ts';

export const UNTRAINED_ATTACK_PENALTY = -2;

export interface AttackInput {
  attackBonus: number;
  attributeModifier: number;
  /** Combat skill level, or null when the attacker lacks even level-0. */
  skill: number | null;
  /** Situational modifiers such as cover, range, or prone targets. */
  modifier?: number;
  steps?: number;
  targetAc: number;
}

export interface AttackResult extends D20Roll {
  score: number;
  hit: boolean;
}

/** Hits on a total equal to or above the target's AC; unlike saves, natural rolls have no special effect. */
export function attackRoll(rng: Rng, input: AttackInput): AttackResult {
  const d = rollD20WithEdge(rng, input.steps ?? 0);
  const skill = input.skill ?? UNTRAINED_ATTACK_PENALTY;
  const score =
    d.total + input.attackBonus + input.attributeModifier + skill + (input.modifier ?? 0);
  return { ...d, score, hit: score >= input.targetAc };
}

export interface ShockRating {
  damage: number;
  /** Null for "/-" Shock, which applies whatever the target's AC. */
  maxAc: number | null;
}

export interface ShockContext {
  targetAc: number;
  /** A shield ignores the first Shock its bearer would suffer each round. */
  shieldNegates: boolean;
  /** Total Defense, some foci, and similar effects. */
  immune: boolean;
}

/**
 * Damage dealt on a miss: the rating plus the attribute modifier and any bonus that explicitly
 * adds to Shock (such as Killing Blow). Zero when the Shock doesn't apply.
 */
export function shockDamage(
  shock: ShockRating | null,
  attributeModifier: number,
  shockBonus: number,
  ctx: ShockContext,
): number {
  if (!shock || ctx.immune || ctx.shieldNegates) return 0;
  if (shock.maxAc !== null && ctx.targetAc > shock.maxAc) return 0;
  return Math.max(0, shock.damage + attributeModifier + shockBonus);
}

export interface DamageInput {
  dice: Dice;
  attributeModifier: number;
  /** Bonuses to hit damage, including those that also add to Shock. */
  bonus?: number;
  /** Bonuses that explicitly add to Shock. */
  shockBonus?: number;
  shock: ShockRating | null;
}

/** A hit never does less damage than the Shock the same attack would have dealt on a miss. */
export function hitDamage(
  rng: Rng,
  input: DamageInput,
  ctx: ShockContext,
): { total: number; dice: number[] } {
  const r = roll(rng, input.dice);
  const rolled = Math.max(0, r.total + input.attributeModifier + (input.bonus ?? 0));
  const floor = shockDamage(input.shock, input.attributeModifier, input.shockBonus ?? 0, ctx);
  return { total: Math.max(rolled, floor), dice: r.dice };
}
