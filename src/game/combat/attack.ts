// Weapon attacks: vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md (2.4.5 attack rolls,
// 2.4.6 damage and Shock, 2.4.4 Total Defense), shields ignoring the first Shock each round (3.4.2),
// Wardpact Invocation (4.4.0), the Warrior's Veteran's Luck (1.5.18), and creature resistances and
// on-hit effects (specials.ts).
import { netSteps } from '../../rules/advantage.ts';
import { attackRoll, hitDamage, shockDamage, type ShockContext } from '../../rules/attacks.ts';
import { effectiveAc, harm, save, say } from './damage.ts';
import { afterHit, resisted } from './specials.ts';
import { attackSteps, rangedModifier } from './targeting.ts';
import type { Attack, Battle, Combatant } from './types.ts';

function shockContext(target: Combatant, attack: Attack): ShockContext {
  return {
    targetAc: effectiveAc(target),
    shieldNegates: false,
    immune: target.totalDefense || (attack.mode === 'melee' && target.meleeShockImmune),
  };
}

/** Shock on a miss; a shield soaks the first Shock its bearer would take each round. */
function missShock(b: Battle, attacker: Combatant, target: Combatant, attack: Attack): void {
  const amount =
    attack.mode === 'melee' ? shockDamage(attack.shock, 0, 0, shockContext(target, attack)) : 0;
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
  say(b, `${attacker.name} misses ${target.name} but deals ${dealt} Shock.`);
  harm(b, target, dealt);
}

export function resolveAttack(
  b: Battle,
  actor: Combatant,
  attack: Attack,
  target: Combatant,
): void {
  const roll = attackRoll(b.rng, {
    attackBonus: attack.hit,
    attributeModifier: 0,
    skill: 0,
    modifier: rangedModifier(b, actor, attack) + b.hitModifier[actor.side],
    steps: netSteps([attackSteps(b, actor, target, attack.mode)]),
    targetAc: effectiveAc(target),
  });
  if (!roll.hit) {
    missShock(b, actor, target, attack);
    return;
  }
  if (target.wardRounds > 0 && !save(b, actor, 'physical').success) {
    say(b, `${actor.name}'s blow slides off the ward around ${target.name}.`);
    return;
  }
  const rolled = hitDamage(
    b.rng,
    {
      dice: attack.damage,
      attributeModifier: 0,
      bonus: attack.damageBonus,
      shock: attack.mode === 'melee' ? attack.shock : null,
    },
    shockContext(target, attack),
  ).total;
  const damage = resisted(target, attack, rolled);
  // Veteran's Luck: once per scene, turn a hit that would drop the Warrior into a miss.
  if (target.veteransLuck && target.status === 'active' && damage >= target.hp) {
    target.veteransLuck = false;
    say(b, `${target.name}'s veteran's luck turns aside ${actor.name}'s blow.`);
    missShock(b, actor, target, attack);
    return;
  }
  say(b, `${actor.name} hits ${target.name} with ${attack.name} for ${damage}.`);
  harm(b, target, damage);
  afterHit(b, attack, target);
}
