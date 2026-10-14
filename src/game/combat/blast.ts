// Elemental Blast (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.7 The
// Elementalist.md): an attack roll with the caster level, the best of its attributes, and its skill,
// then the dice plus the level and that attribute. The fight screen's odds read the same roll.
import type { CombatEffect } from '../../data/schemas/index.ts';
import { netSteps } from '../../rules/advantage.ts';
import { attackRoll, type AttackInput } from '../../rules/attacks.ts';
import { roll } from '../../rules/dice.ts';
import { effectiveAc, harm } from './damage.ts';
import { recordBlow } from './log.ts';
import { attackSteps, hitModifier } from './targeting.ts';
import type { Battle, Combatant } from './types.ts';

export type BlastEffect = Extract<CombatEffect, { kind: 'blast' }>;

/** The best of the blast's attributes, which it adds to hit and to damage. */
export const blastAttribute = (actor: Combatant, e: BlastEffect) =>
  Math.max(...e.attributes.map((a) => actor.modifiers[a]));

/** The blast's attack roll against a target, at a caster level. */
export function blastInput(
  b: Battle,
  actor: Combatant,
  e: BlastEffect,
  target: Combatant,
  level: number,
): AttackInput {
  return {
    attackBonus: level,
    attributeModifier: blastAttribute(actor, e),
    skill: actor.skills[e.skill] ?? null,
    modifier: hitModifier(b, actor),
    steps: netSteps([attackSteps(b, actor, target, 'ranged')]),
    targetAc: effectiveAc(target),
  };
}

/** Throws the blast: on a hit, the dice plus the level and the attribute. */
export function blast(
  b: Battle,
  actor: Combatant,
  e: BlastEffect,
  target: Combatant,
  level: number,
): void {
  if (!attackRoll(b.rng, blastInput(b, actor, e, target, level)).hit) {
    recordBlow(b, 'miss', actor, target);
    return;
  }
  const damage = roll(b.rng, e.damage).total + level + blastAttribute(actor, e);
  recordBlow(b, 'hit', actor, target, damage);
  harm(b, target, damage);
}
