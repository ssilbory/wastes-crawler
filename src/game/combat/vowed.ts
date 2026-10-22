// The Vowed's combat arts (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.17 The
// Vowed.md): Brutal Counter, Hurling Throw, Mob Justice, and Revivifying Breath. When each fires,
// and Hurling Throw's throw costing the target its next action, are Sam's calls
// (docs/rules-adaptation.md, The Vowed).
import { save } from './damage.ts';
import { say } from './log.ts';
import { artReady, BREATH, breathe, spendDay } from './reactions.ts';
import { canAct, foeSide, targets } from './targeting.ts';
import type { Attack, Battle, CasterState, Combatant } from './types.ts';

/** Effort left over what Revivifying Breath may still need this scene. */
function spare(c: Combatant): boolean {
  const k = c.caster as CasterState;
  const keep = k.arts.includes(BREATH) && !k.usedThisScene.has(BREATH) ? 1 : 0;
  return k.effortMax - k.effortUsed > keep;
}

/** A scene art ready to use without spending Effort Revivifying Breath may need. */
const sceneReady = (c: Combatant, art: string) => artReady(c, art) && spare(c);

/**
 * Brutal Counter: after a foe's melee attack on the Vowed, hit or miss, Effort for the scene buys a
 * free attack back with a melee attack that reaches the assailant.
 */
export function counterAttack(b: Battle, attacker: Combatant, attack: Attack, target: Combatant) {
  if (attack.mode !== 'melee' || attacker.side === target.side) return null;
  if (!canAct(target) || !canAct(attacker) || !sceneReady(target, 'brutal-counter')) return null;
  const back = target.attacks.find(
    (a) => a.mode === 'melee' && targets(b, target, a).includes(attacker),
  );
  if (!back) return null;
  (target.caster as CasterState).effortUsed += 1;
  say(b, `${target.name} answers ${attacker.name}'s blow.`);
  return back;
}

/**
 * Hurling Throw: after a hit, Effort for the scene throws a target no larger than an ox, once a
 * round each; a failed Physical save leaves it prone, and getting up costs its next action.
 */
export function hurl(b: Battle, actor: Combatant, target: Combatant): void {
  const key = `hurling-throw:${target.id}:${b.round}`;
  const c = actor.caster;
  if (!c || target.status !== 'active' || target.tags.has('large')) return;
  if (c.usedThisScene.has(key) || !sceneReady(actor, 'hurling-throw')) return;
  c.effortUsed += 1;
  c.usedThisScene.add(key);
  if (save(b, target, 'physical').success) return;
  target.stunned = true;
  say(b, `${actor.name} hurls ${target.name} to the ground.`);
}

/** Foes in melee with the combatant: able, armed for melee, and facing it from the front rows. */
const meleeFoes = (b: Battle, c: Combatant) =>
  c.row !== 0
    ? 0
    : b.combatants.filter(
        (o) =>
          o.side === foeSide(c) &&
          o.row === 0 &&
          canAct(o) &&
          o.attacks.some((a) => a.mode === 'melee'),
      ).length;

/**
 * On Turn: Mob Justice, once two foes or more are in melee, commits Effort for the day and makes
 * the Vowed immune to Shock while that holds, for the scene; and Revivifying Breath, once a scene,
 * heals a Vowed at half their hit points or less 1d6 plus their level, with no System Strain.
 */
export function vowedTurn(b: Battle, actor: Combatant): void {
  const c = actor.caster as CasterState;
  const mob = meleeFoes(b, actor) >= 2;
  if (!c.usedThisScene.has('mob-justice') && mob && artReady(actor, 'mob-justice')) {
    spendDay(c);
    c.usedThisScene.add('mob-justice');
    say(b, `${actor.name} sets against the mob.`);
  }
  actor.mobJustice = mob && c.usedThisScene.has('mob-justice');
  if (actor.hp * 2 <= actor.maxHp && !c.usedThisScene.has(BREATH) && artReady(actor, BREATH)) {
    spendDay(c);
    breathe(b, actor);
  }
}
