// Creature specials (Phase 14a; docs/rules-adaptation.md, Creature specials): breath weapons that
// sweep a row with a save for half, resistances to blunt or edged weapons and missiles, and what
// a hit does beyond its damage. Poison is the SRD's: a Physical save or the loss of half the
// victim's maximum hit points (vendor/wwn-srd/2.0 The Rules of the Game/2.10.0 Falling and Other
// Hazards.md, Poisons).
import { roll } from '../../rules/dice.ts';
import { harm, save, say } from './damage.ts';
import { negatesUndead } from './reactions.ts';
import { isUp } from './targeting.ts';
import type { Attack, Battle, Combatant } from './types.ts';

/** The enemy row with the most creatures up, nearest first; null with nobody up. */
export function breathRow(b: Battle, actor: Combatant): number | null {
  const counts = [0, 1, 2].map(
    (row) => b.combatants.filter((c) => c.side !== actor.side && c.row === row && isUp(c)).length,
  );
  const most = Math.max(...counts);
  return most === 0 ? null : counts.indexOf(most);
}

/** One damage roll for the whole row; each victim saves for half. */
export function breathe(b: Battle, actor: Combatant, row: number): void {
  const breath = actor.breath;
  if (!breath || actor.breathLeft === 0) return;
  actor.breathLeft -= 1;
  const total = roll(b.rng, breath.damage).total;
  say(b, `${actor.name} unleashes ${breath.name}.`);
  for (const t of b.combatants.filter((c) => c.side !== actor.side && c.row === row && isUp(c))) {
    if (negatesUndead(b, actor, t)) continue;
    harm(b, t, save(b, t, breath.save).success ? Math.floor(total / 2) : total);
  }
}

/** Damage after the target's resistances to blunt or edged weapons and to missiles. */
export function resisted(target: Combatant, attack: Attack, amount: number): number {
  const r = target.resist;
  if (!r || amount === 0) return amount;
  if (attack.mode !== 'melee' && r.missiles) return 1;
  const halved = attack.blunt ? r.blunt : attack.mode === 'melee' ? r.edged : undefined;
  return halved ? Math.max(1, Math.floor(amount / 2)) : amount;
}

/** Poison or paralysis from a hit on a target still standing. */
export function afterHit(b: Battle, attack: Attack, target: Combatant): void {
  const effect = attack.onHit;
  if (!effect || target.status !== 'active') return;
  if (effect.kind === 'poison') {
    // Unaging: immune to poisons (Phase 15).
    if (target.poisonImmune || save(b, target, 'physical', -effect.penalty).success) return;
    say(b, `${target.name} is poisoned.`);
    harm(b, target, Math.floor(target.maxHp / 2));
    return;
  }
  if (target.tags.has('unliving') || save(b, target, 'physical').success) return;
  target.heldRounds = Math.max(target.heldRounds, roll(b.rng, effect.rounds).total);
  say(b, `${target.name} is paralyzed.`);
}
