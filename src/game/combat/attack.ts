// Weapon attacks: vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md (2.4.5 attack rolls,
// 2.4.6 damage and Shock, 2.4.4 Total Defense), shields ignoring the first Shock each round (3.4.2),
// Wardpact Invocation and Mantle of Disjecting Dissection (4.4.0), the Warrior's Veteran's Luck
// (1.5.18), and creature resistances and on-hit effects (specials.ts).
import { netSteps } from '../../rules/advantage.ts';
import { attackRoll, hitDamage, shockDamage, type ShockContext } from '../../rules/attacks.ts';
import { crossWall, mantleCut, subdue } from './conditions.ts';
import { effectiveAc, harm, save, say } from './damage.ts';
import { afterHit, resisted } from './specials.ts';
import { negatesUndead } from './reactions.ts';
import { attackSteps, hitModifier, rangedModifier } from './targeting.ts';
import type { Attack, Battle, Combatant } from './types.ts';

function shockContext(target: Combatant, attack: Attack): ShockContext {
  return {
    targetAc: effectiveAc(target),
    shieldNegates: false,
    immune:
      target.totalDefense ||
      target.sanctified ||
      (attack.mode === 'melee' && target.meleeShockImmune),
    // Cold Flesh: no more than 2 from any one Shock (Phase 15).
    cap: target.shockCap,
  };
}

/** Shock on a miss; a shield soaks the first Shock its bearer would take each round. */
function missShock(b: Battle, attacker: Combatant, target: Combatant, attack: Attack): void {
  const blessed = b.damageBonus[attacker.side];
  const amount =
    attack.mode === 'melee'
      ? shockDamage(attack.shock, 0, blessed, shockContext(target, attack))
      : 0;
  if (amount === 0) {
    say(b, `${attacker.name} misses ${target.name}.`);
    return;
  }
  if (target.shield && !target.shieldUsed) {
    target.shieldUsed = true;
    say(b, `${target.name}'s shield turns ${attacker.name}'s blow.`);
    return;
  }
  const dealt = resisted(target, attack, amount);
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

export function resolveAttack(
  b: Battle,
  actor: Combatant,
  attack: Attack,
  target: Combatant,
  boost: AttackBoost | null = null,
): void {
  if (!crossWall(b, actor, attack) || !mantleCut(b, actor, target, attack)) return;
  // Red Harvest's +4 is spent on the next hit roll (Phase 15).
  const harvest = actor.nextHitBonus;
  actor.nextHitBonus = 0;
  const roll = attackRoll(b.rng, {
    attackBonus: attack.hit + (boost?.hit ?? 0) + harvest,
    attributeModifier: 0,
    skill: 0,
    modifier: rangedModifier(b, actor, attack) + hitModifier(b, actor),
    steps: netSteps([attackSteps(b, actor, target, attack.mode)]),
    targetAc: effectiveAc(target),
  });
  // Call of the Tomb: every blow lands on the doomed, for the most its dice can do (4.6.0).
  const doomed = target.doomedUntil >= b.round;
  if (!roll.hit && !doomed) {
    missShock(b, actor, target, attack);
    return;
  }
  if (negatesUndead(b, actor, target)) return;
  if (target.wardRounds > 0 && !save(b, actor, 'physical').success) {
    say(b, `${actor.name}'s blow slides off the ward around ${target.name}.`);
    return;
  }
  const blessed = b.damageBonus[actor.side];
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
        bonus: attack.damageBonus + blessed + actor.flame,
        shock: attack.mode === 'melee' ? attack.shock : null,
        shockBonus: blessed,
      },
      shockContext(target, attack),
    ).total;
  // Enfeebling Wave: damage rolled twice, the worse kept (4.6.0).
  const damageRoll = () => (actor.enfeebledUntil >= b.round ? Math.min(once(), once()) : once());
  // Smite the Wicked rolls the damage twice and keeps the better, then adds the level.
  const rolled = boost ? Math.max(damageRoll(), damageRoll()) + boost.damage : damageRoll();
  // The doomed lose their defenses against blows, too.
  const damage = doomed ? rolled : resisted(target, attack, rolled);
  // Veteran's Luck: once per scene, turn a hit that would drop the Warrior into a miss.
  if (target.veteransLuck && target.status === 'active' && damage >= target.hp) {
    target.veteransLuck = false;
    say(b, `${target.name}'s veteran's luck turns aside ${actor.name}'s blow.`);
    missShock(b, actor, target, attack);
    return;
  }
  if (subdue(b, actor, target, damage)) return;
  say(b, `${actor.name} hits ${target.name} with ${attack.name} for ${damage}.`);
  harm(b, target, damage);
  afterHit(b, attack, target);
}
