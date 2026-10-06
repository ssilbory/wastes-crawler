// Necromancer magic in combat (Phase 18c): what each spell does when cast, from its text in
// vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0 Necromancer Spells.md (docs/rules-adaptation.md,
// Necromancer spells in combat). What the spells leave behind plays out in damage.ts, attack.ts,
// and conditions.ts; Everlasting is cast for the player as an ally would fall (reactions.ts).
import type { CombatEffect } from '../../data/schemas/index.ts';
import { addStrain } from '../../rules/strain.ts';
import { save, say } from './damage.ts';
import type { Resists } from './high-magic.ts';
import { isUp } from './targeting.ts';
import type { Battle, CasterState, Combatant } from './types.ts';

/** Rounds that outlast any fight. */
const SCENE = 1000;

/** Flesh to work on: the living, or the bodied undead, but not automatons and oozes. */
const fleshed = (c: Combatant) => !c.tags.has('unliving') || c.tags.has('undead');

/** A Necromancer spell's effect; false for any other effect. */
export function necromancerEffect(
  b: Battle,
  actor: Combatant,
  e: CombatEffect,
  target: Combatant | undefined,
  row: number | undefined,
  resists: Resists,
): boolean {
  const level = (actor.caster as CasterState).level;
  switch (e.kind) {
    case 'vitality':
      if (target) {
        target.vitality = { saveBonus: actor.skills[e.skill] ?? 0, healReady: true };
        if (target.strain) target.strain = addStrain(target.strain, e.strain, 'condition').state;
        say(b, `${target.name}'s life burns stronger.`);
      }
      return true;
    case 'enfeeble':
      for (const t of b.combatants.filter(
        (c) => c.side !== actor.side && c.row === row && isUp(c) && !c.tags.has('unliving'),
      )) {
        t.enfeebledUntil = resists(t, e.save) ? b.round + 1 : SCENE;
        say(b, `${t.name} is enfeebled.`);
      }
      return true;
    case 'compel':
      if (target && fleshed(target)) {
        target.compelled = level;
        say(b, `${target.name}'s flesh obeys ${actor.name} now.`);
      }
      return true;
    case 'deathless':
      if (target) {
        target.deathlessUntil = b.round + level - 1;
        say(b, `${target.name} forgets how to die.`);
      }
      return true;
    case 'merge':
      if (target && target !== actor) {
        actor.mergedWith = target.id;
        target.mergedWith = actor.id;
        say(b, `${actor.name} and ${target.name} share one life.`);
      }
      return true;
    case 'tomb':
      for (const t of b.combatants.filter((c) => c.side !== actor.side && isUp(c))) {
        t.doomedUntil = resists(t, e.save) ? b.round : b.round + level - 1;
        say(b, `${t.name} feels the weight of the grave.`);
      }
      return true;
    case 'everlasting':
      return true;
    case 'final-death': {
      const foes = b.combatants.filter((c) => c.side !== actor.side && c.row === row && isUp(c));
      for (const t of foes.slice(0, level)) {
        t.finalDeath = true;
        say(b, `${t.name} is marked for the final death.`);
      }
      return true;
    }
    default:
      return false;
  }
}

/**
 * Final Death (4.6.0): the cursed can't be healed; each failed healing gives a Physical save to
 * throw the curse off. True if the healing fails.
 */
export function healingFails(b: Battle, target: Combatant): boolean {
  if (!target.finalDeath) return false;
  say(b, `The final death holds ${target.name} beyond healing.`);
  if (save(b, target, 'physical').success) {
    target.finalDeath = false;
    say(b, `${target.name} throws off the curse.`);
  }
  return true;
}
