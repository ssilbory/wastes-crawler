// Magic weapons' special abilities in a fight (docs/rules-adaptation.md, Potions, scrolls, and
// magic devices: Abilities; vendor/wwn-srd/4.0 Magic and Spellcasting/4.9.0 Magic Items and
// Enchanted Treasures.md, 4.9.3): Flaming adds its dice to every hit, a Bane adds its dice to a hit
// on its kind of foe, and Vampiric gives the wielder hit points back for each foe it drops.
import { roll } from '../../rules/dice.ts';
import { say } from './log.ts';
import { isUp } from './targeting.ts';
import type { Attack, Battle, Combatant } from './types.ts';

/** Whether a Bane's kind of foe is this target. */
function baneFits(against: 'undead' | 'beast' | 'unliving', target: Combatant): boolean {
  return against === 'beast' ? target.beast : target.tags.has(against);
}

/** The ability's extra damage on this hit. */
export function abilityDamage(b: Battle, attack: Attack, target: Combatant): number {
  const m = attack.magic;
  if (m?.kind === 'flaming') return roll(b.rng, m.dice).total;
  if (m?.kind === 'bane' && baneFits(m.against, target)) return roll(b.rng, m.dice).total;
  return 0;
}

/** Vampiric: the wielder takes hit points back when the blow drops the foe. */
export function drink(b: Battle, actor: Combatant, attack: Attack, target: Combatant): void {
  const m = attack.magic;
  if (m?.kind !== 'vampiric' || isUp(target) || !isUp(actor)) return;
  actor.hp = Math.min(actor.maxHp, actor.hp + m.hp);
  say(b, `${attack.name} drinks, and ${actor.name} grows stronger.`);
}
