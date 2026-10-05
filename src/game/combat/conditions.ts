// What High Magic leaves behind in a fight (Phase 18a; vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.4.0 High Magic Spells by Level.md): Mantle of Disjecting Dissection's blades,
// the Torment of Tumefaction, Resounding Temporal Echo's extra attack, the Phantasmal Eidolon's
// harmless blows, and the banished finding their way back; Elemental Vallation's fire and the
// Fury of the Elements from 4.5.0.
import { roll } from '../../rules/dice.ts';
import { addStrain } from '../../rules/strain.ts';
import { harm, save, say } from './damage.ts';
import { smite } from './elementalist.ts';
import { canAct, targets } from './targeting.ts';
import type { Action, Attack, Battle, Combatant } from './types.ts';

/** Monster sides stand in up to three rows. */
const ENEMY_ROWS = 3;

/** The mantle's blades cut a melee attacker first; false if the attacker can no longer swing. */
export function mantleCut(
  b: Battle,
  attacker: Combatant,
  target: Combatant,
  attack: Attack,
): boolean {
  const m = target.mantle;
  if (!m || attack.mode !== 'melee' || save(b, attacker, m.save).success) return true;
  say(b, `The blades around ${target.name} cut ${attacker.name}.`);
  harm(b, attacker, roll(b.rng, m.damage).total + m.bonus);
  return canAct(attacker);
}

/** A blow from a servant that can't kill knocks a monster out instead; true if it did. */
export function subdue(b: Battle, attacker: Combatant, target: Combatant, damage: number): boolean {
  if (!attacker.subdues || target.kind !== 'monster' || damage < target.hp) return false;
  target.status = 'out';
  say(b, `${attacker.name} knocks ${target.name} senseless.`);
  return true;
}

/** The torment bites once a round when the cursed creature does something violent. */
export function tormentStrike(b: Battle, actor: Combatant): void {
  const t = actor.torment;
  if (!t || t.round === b.round) return;
  t.round = b.round;
  say(b, `${actor.name}'s torment flares.`);
  harm(b, actor, t.damage);
}

/** One try, as a Main Action, to throw off the torment; a failure holds it for the scene. */
export function shakeOff(b: Battle, actor: Combatant): void {
  const t = actor.torment;
  if (!t || t.tried || t.lasting) return;
  if (save(b, actor, 'physical').success) {
    actor.torment = null;
    say(b, `${actor.name} throws off the torment.`);
  } else {
    t.tried = true;
    say(b, `${actor.name} fails to throw off the torment.`);
  }
}

/** The action if it is an attack that can reach its target now, else null. */
export function landing(b: Battle, actor: Combatant, action: Action): Action | null {
  if (action.kind !== 'attack') return null;
  const attack = actor.attacks[action.attack];
  return attack && targets(b, actor, attack).some((t) => t.id === action.target) ? action : null;
}

/** A swing with the first usable attack at the foe in reach with the fewest hit points. */
export function weakestSwing(b: Battle, actor: Combatant): Action | null {
  for (const [index, attack] of actor.attacks.entries()) {
    const foes = targets(b, actor, attack);
    if (foes.length === 0) continue;
    const weakest = foes.reduce((a, f) => (f.hp < a.hp ? f : a));
    return { kind: 'attack', attack: index, target: weakest.id };
  }
  return null;
}

/** Whether Temporal Echo still quickens the actor this round. */
export const quickens = (b: Battle, actor: Combatant) =>
  actor.echo !== null && actor.echo.until >= b.round && canAct(actor) && !b.outcome;

/** Pays Temporal Echo's System Strain for an extra attack; false if it can't be borne. */
export function echoes(b: Battle, actor: Combatant): boolean {
  const s = actor.strain;
  if (s) {
    const outcome = addStrain(s, (actor.echo as NonNullable<Combatant['echo']>).strain, 'push');
    if (outcome.kind !== 'applied') return false;
    actor.strain = outcome.state;
  }
  say(b, `${actor.name} moves in a blur of quickened time.`);
  return true;
}

/**
 * Elemental Vallation (4.5.0): a foe stepping up to strike the walled side in melee crosses the
 * fire once and burns; false if it falls before the blow.
 */
export function crossWall(b: Battle, attacker: Combatant, attack: Attack): boolean {
  if (attack.mode !== 'melee') return true;
  for (const wall of b.walls) {
    if (wall.side !== attacker.side || wall.crossed.includes(attacker.id)) continue;
    wall.crossed.push(attacker.id);
    say(b, `${attacker.name} crosses the wall of fire.`);
    harm(b, attacker, roll(b.rng, wall.damage).total + wall.bonus);
  }
  return canAct(attacker);
}

/** Fury of the Elements drifts a row, at random, among the foe's rows and smites it again. */
function furyWanders(b: Battle): void {
  const f = b.fury;
  if (!f) return;
  if (f.roundsLeft <= 0) {
    b.fury = null;
    say(b, 'The fury of the elements dies out.');
    return;
  }
  f.roundsLeft -= 1;
  f.row = Math.max(0, Math.min(ENEMY_ROWS - 1, f.row + (b.rng.int(0, 1) === 0 ? -1 : 1)));
  say(b, `The fury of the elements wanders to row ${f.row + 1}.`);
  smite(b, f.side, f.row, roll(b.rng, f.damage).total);
}

/** At a round's start, the banished come back and the Fury of the Elements wanders on. */
export function roundPasses(b: Battle): void {
  furyWanders(b);
  for (const c of b.combatants) {
    if (c.returnsRound === 0 || c.returnsRound > b.round) continue;
    c.returnsRound = 0;
    c.status = 'active';
    say(b, `${c.name} returns from the black glass maze.`);
  }
}
