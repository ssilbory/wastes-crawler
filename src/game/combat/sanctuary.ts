// High Magic's sheltering spells in combat (Phase 18d; vendor/wwn-srd/4.0 Magic and Spellcasting/
// 4.4.0 High Magic Spells by Level.md; Sam's calls, docs/rules-adaptation.md, High Magic in combat):
// The Long Amber Moment, Velocitous Imbuement, The Verdant Vallation, Conjunct the Vital Viscera,
// and the Invincible Citadel, which is cast for the player as an ally would fall (reactions.ts).
// The vines play out in conditions.ts, the frozen and the fleet in damage.ts, targeting.ts, and
// aftermath.ts.
import type { CombatEffect } from '../../data/schemas/index.ts';
import { addStrain } from '../../rules/strain.ts';
import { say } from './log.ts';
import { healingFails } from './necromancer.ts';
import { canAct, foeSide, inLine, isUp } from './targeting.ts';
import type { Battle, CasterState, Combatant } from './types.ts';

/** A sheltering spell's effect; false for any other effect. */
export function sanctuaryEffect(
  b: Battle,
  actor: Combatant,
  e: CombatEffect,
  target: Combatant | undefined,
): boolean {
  const level = (actor.caster as CasterState).level;
  switch (e.kind) {
    case 'amber':
      if (target) {
        target.amber = true;
        say(b, `${target.name} is frozen in a moment of amber light.`);
      }
      return true;
    case 'fleet': {
      const allies = inLine(
        b.combatants.filter((x) => x.side === actor.side && isUp(x) && !x.noncombatant),
      );
      for (const x of allies.slice(0, level)) {
        x.fleet = true;
        if (x.strain) x.strain = addStrain(x.strain, e.strain, 'condition').state;
      }
      say(b, `${b.sideNames[actor.side]} grow impossibly fleet of foot.`);
      return true;
    }
    case 'vines':
      b.vines = { side: foeSide(actor), hp: e.hpPerLevel * level };
      say(b, `A wall of thick vines blooms before ${b.sideNames[actor.side]}.`);
      return true;
    case 'conjunct':
      if (target) conjunct(b, target);
      return true;
    default:
      return false;
  }
}

const spare = (c: Combatant) => c.hp - Math.ceil(c.maxHp / 2);

/** Conjunct the Vital Viscera's giver: the ally able to act with the most to spare above half. */
export function donorFor(b: Battle, target: Combatant): Combatant | null {
  return b.combatants
    .filter((c) => c.side === target.side && c !== target && canAct(c))
    .reduce<Combatant | null>((best, c) => (spare(c) > (best ? spare(best) : 0) ? c : best), null);
}

/** Conjunct the Vital Viscera: the giver gives what it can (spells.ts lets it be cast only then). */
function conjunct(b: Battle, target: Combatant): void {
  const donor = donorFor(b, target) as Combatant;
  if (healingFails(b, target)) return;
  const amount = Math.min(spare(donor), target.maxHp - target.hp);
  donor.hp -= amount;
  if (target.status === 'dying' || target.status === 'stable') target.status = 'active';
  target.hp += amount;
  say(b, `${amount} hit points flow from ${donor.name} into ${target.name}.`);
}
