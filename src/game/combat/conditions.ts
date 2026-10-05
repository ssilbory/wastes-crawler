// What High Magic leaves behind in a fight (Phase 18a; vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.4.0 High Magic Spells by Level.md): Mantle of Disjecting Dissection's blades,
// the Torment of Tumefaction, Resounding Temporal Echo's extra attack, the Phantasmal Eidolon's
// harmless blows, and the banished finding their way back.
import { roll } from '../../rules/dice.ts';
import { addStrain } from '../../rules/strain.ts';
import { harm, save, say } from './damage.ts';
import { canAct } from './targeting.ts';
import type { Attack, Battle, Combatant } from './types.ts';

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

/** At a round's start, those who found their way out of the labyrinth come back. */
export function roundPasses(b: Battle): void {
  for (const c of b.combatants) {
    if (c.returnsRound === 0 || c.returnsRound > b.round) continue;
    c.returnsRound = 0;
    c.status = 'active';
    say(b, `${c.name} returns from the black glass maze.`);
  }
}
