// Weapon attacks: vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md (2.4.5 attack rolls,
// 2.4.6 damage and Shock, 2.4.4 Total Defense), shields ignoring the first Shock each round (3.4.2),
// Wardpact Invocation and Mantle of Disjecting Dissection (4.4.0), the Warrior's Veteran's Luck
// (1.5.18), creature resistances and on-hit effects (specials.ts), and the Vowed's Brutal Counter
// and Hurling Throw (vowed.ts).
import { spendVenom, venom } from './forms.ts';
import { netSteps } from '../../rules/advantage.ts';
import {
  attackRoll,
  hitDamage,
  shockDamage,
  type AttackInput,
  type ShockContext,
} from '../../rules/attacks.ts';
import { crossWall, cutVines, mantleCut, subdue } from './conditions.ts';
import { effectiveAc, harm, save, say } from './damage.ts';
import { afterHit, resisted } from './specials.ts';
import { abilityDamage, drink } from './weapon-abilities.ts';
import { negatesUndead } from './reactions.ts';
import { counterAttack, hurl } from './vowed.ts';
import { attackSteps, canAct, hitModifier, rangedModifier } from './targeting.ts';
import type { Attack, Battle, Combatant } from './types.ts';
import { recordBlow } from './log.ts';
import { knowsWeakSpot, provoke } from './companions.ts';

export function shockContext(target: Combatant, attack: Attack): ShockContext {
  return {
    targetAc: effectiveAc(target),
    shieldNegates: false,
    immune:
      target.totalDefense ||
      target.sanctified ||
      target.mobJustice ||
      (attack.mode === 'melee' && target.meleeShockImmune),
    // Cold Flesh: no more than 2 from any one Shock (Phase 15).
    cap: target.shockCap,
  };
}

/**
 * A hit never does less than the Shock a miss would have dealt (vendor/wwn-srd/2.0 The Rules of the
 * Game/2.4.0 Combat.md, Shock), and a miss's Shock is the one a ready shield ignores. Asking is
 * hypothetical, so it doesn't use the shield up.
 */
export const hitShockContext = (target: Combatant, attack: Attack): ShockContext => ({
  ...shockContext(target, attack),
  shieldNegates: target.shield && !target.shieldUsed,
});

/**
 * The roll an attack makes against a target, with `bonus` added to hit (Smite the Wicked, Red
 * Harvest). The fight screen's odds read the same input, so they match the roll.
 */
export function attackInput(
  b: Battle,
  actor: Combatant,
  attack: Attack,
  target: Combatant,
  bonus: number,
): AttackInput {
  return {
    attackBonus: attack.hit + bonus + (actor.edge?.hit ?? 0),
    attributeModifier: 0,
    skill: 0,
    modifier: rangedModifier(b, actor, attack) + hitModifier(b, actor),
    steps: netSteps([attackSteps(b, actor, target, attack.mode)]),
    targetAc: effectiveAc(target),
  };
}

const record = recordBlow;

/** Shock on a miss; a shield soaks the first Shock its bearer would take each round. */
function missShock(b: Battle, attacker: Combatant, target: Combatant, attack: Attack): void {
  const blessed = attacker.blessed;
  const amount =
    attack.mode === 'melee'
      ? shockDamage(attack.shock, 0, blessed, shockContext(target, attack))
      : 0;
  if (amount === 0) {
    record(b, 'miss', attacker, target);
    say(b, `${attacker.name} misses ${target.name}.`);
    return;
  }
  if (target.shield && !target.shieldUsed) {
    target.shieldUsed = true;
    record(b, 'turned', attacker, target);
    say(b, `${target.name}'s shield turns ${attacker.name}'s blow.`);
    return;
  }
  const dealt = resisted(target, attack, amount);
  record(b, 'shock', attacker, target, dealt);
  // The Phantasmal Eidolon's Shock can't kill either (4.4.0).
  if (subdue(b, attacker, target, dealt)) return;
  say(b, `${attacker.name} misses ${target.name} but deals ${dealt} Shock.`);
  harm(b, target, dealt);
}

/** Smite the Wicked's edge on one attack (Phase 14c). */
export interface AttackBoost {
  hit: number;
  /** Automatic damage on a hit. */
  damage: number;
}

/** An attack, and the Vowed's Brutal Counter after it (1.5.17). */
export function resolveAttack(
  b: Battle,
  actor: Combatant,
  attack: Attack,
  target: Combatant,
  boost: AttackBoost | null = null,
): void {
  strike(b, actor, attack, target, boost);
  const back = counterAttack(b, actor, attack, target);
  if (back) strike(b, target, back, actor, null);
}

function strike(
  b: Battle,
  actor: Combatant,
  attack: Attack,
  target: Combatant,
  boost: AttackBoost | null,
): void {
  if (!crossWall(b, actor, attack, target) || !cutVines(b, actor, attack, target)) return;
  if (!mantleCut(b, actor, target, attack)) return;
  provoke(actor, target);
  // Red Harvest's +4 is spent on the next hit roll (Phase 15).
  const harvest = actor.nextHitBonus;
  actor.nextHitBonus = 0;
  const roll = attackRoll(
    b.rng,
    attackInput(b, actor, attack, target, (boost?.hit ?? 0) + harvest),
  );
  // Call of the Tomb: every blow lands on the doomed, for the most its dice can do (4.6.0).
  const doomed = target.doomedUntil >= b.round;
  if (!roll.hit && !doomed) {
    missShock(b, actor, target, attack);
    return;
  }
  if (negatesUndead(b, actor, target)) {
    record(b, 'turned', actor, target);
    return;
  }
  if (target.wardRounds > 0 && !save(b, actor, 'physical').success) {
    record(b, 'turned', actor, target);
    say(b, `${actor.name}'s blow slides off the ward around ${target.name}.`);
    return;
  }
  const blessed = actor.blessed;
  const d = attack.damage;
  const dice = doomed
    ? { count: d.count, sides: 1, modifier: d.modifier + d.count * (d.sides - 1) }
    : d;
  const once = () =>
    hitDamage(
      b.rng,
      {
        dice,
        attributeModifier: 0,
        // Flame Without End adds to the hit's damage but not to Shock (4.5.0).
        bonus: attack.damageBonus + blessed + actor.flame + (actor.edge?.damage ?? 0),
        shock: attack.mode === 'melee' ? attack.shock : null,
        shockBonus: blessed,
      },
      hitShockContext(target, attack),
    ).total;
  // Enfeebling Wave: damage rolled twice, the worse kept (4.6.0).
  const damageRoll = () => (actor.enfeebledUntil >= b.round ? Math.min(once(), once()) : once());
  // Smite the Wicked rolls the damage twice and keeps the better, then adds the level; Know the
  // Weak Spot rolls it twice against a beast (1.5.4).
  const twice = boost !== null || knowsWeakSpot(actor, target);
  const rolled =
    (twice ? Math.max(damageRoll(), damageRoll()) : damageRoll()) + (boost?.damage ?? 0);
  // The doomed lose their defenses against blows, too.
  const blow = doomed ? rolled : resisted(target, attack, rolled);
  // Venom and a weapon's ability ride on the blow, so they count toward whether it drops the target.
  const venomExtra = venom(b, actor, attack, target);
  const damage = blow + venomExtra + abilityDamage(b, attack, target);
  // Veteran's Luck: once per scene, turn a hit that would drop the Warrior into a miss.
  if (target.veteransLuck && target.status === 'active' && damage >= target.hp) {
    target.veteransLuck = false;
    say(b, `${target.name}'s veteran's luck turns aside ${actor.name}'s blow.`);
    missShock(b, actor, target, attack);
    return;
  }
  // Rider: once a fight the rider negates a blow that would drop their mount (1.6.0).
  const rider = target.steedGuard ? b.combatants.find((c) => c.id === target.rider) : undefined;
  if (rider && canAct(rider) && target.status === 'active' && damage >= target.hp) {
    target.steedGuard = false;
    record(b, 'turned', actor, target);
    say(b, `${rider.name} turns ${target.name} aside from ${actor.name}'s blow.`);
    return;
  }
  spendVenom(b, actor, venomExtra);
  record(b, 'hit', actor, target, damage);
  if (subdue(b, actor, target, damage)) return;
  say(b, `${actor.name} hits ${target.name} with ${attack.name} for ${damage}.`);
  harm(b, target, damage);
  drink(b, actor, attack, target);
  afterHit(b, attack, target);
  hurl(b, actor, target);
}
