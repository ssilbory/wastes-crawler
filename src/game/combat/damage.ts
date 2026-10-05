// Damage, falling, and saves in combat: vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury,
// Healing, And System Strain.md (2.5.1: PCs are Mortally Injured at 0 HP and die if Frail; unnamed
// NPCs die), and the rear-cover save advantage in docs/rules-adaptation.md.
import { netSteps } from '../../rules/advantage.ts';
import { rollSave, type SaveResult, type SaveType } from '../../rules/saves.ts';
import { covered } from './targeting.ts';
import { say } from './log.ts';
import { abnegate, keepsDying, redHarvest, vitalFurnace } from './reactions.ts';
import type { Battle, Combatant } from './types.ts';

export { say };

/** Applies damage. Sleepers wake; a hit on a dying PC kills them. */
export function harm(b: Battle, target: Combatant, amount: number): void {
  if (amount <= 0) return;
  if (target.status === 'dying') {
    target.status = 'dead';
    say(b, `${target.name} is slain.`);
    redHarvest(b, target);
    return;
  }
  if (target.status === 'asleep') target.status = 'active';
  // Wrath of the Most High falls with the first damage before it lapses (Phase 14c).
  if (target.wrath) {
    if (b.round <= target.wrath.until) amount += target.wrath.bonus;
    target.wrath = null;
  }
  if (vitalFurnace(b, target, amount)) return;
  target.hp = Math.max(0, target.hp - amount);
  if (target.hp > 0) return;
  if (target.kind === 'monster') {
    die(b, target);
    return;
  }
  // The Frail die at once; Abnegation of Life still spares them (Phase 18a).
  if (target.frail) {
    if (!abnegate(b, target)) die(b, target);
    return;
  }
  if (keepsDying(b, target)) {
    target.status = 'stable';
    target.fellRound = b.round;
    return;
  }
  if (abnegate(b, target)) return;
  target.status = 'dying';
  target.fellRound = b.round;
  say(b, `${target.name} falls, mortally wounded.`);
}

function die(b: Battle, target: Combatant): void {
  target.status = 'dead';
  say(b, `${target.name} dies.`);
  redHarvest(b, target);
}

/** A save with rear-cover advantage and Broken disadvantage. */
export function save(b: Battle, target: Combatant, type: SaveType, modifier = 0): SaveResult {
  const steps = netSteps([covered(b, target) ? 1 : 0, target.strain?.broken ? -1 : 0]);
  const repose = type === 'physical' ? target.reposePenalty : 0;
  // Sanctified Ward: +4 to every save (1.5.5.1).
  const ward = target.sanctified ? 4 : 0;
  return rollSave(b.rng, target.saves[type], { modifier: modifier - repose + ward, steps });
}

/**
 * AC with a natural AC if better (Armor of God, Cold Flesh), Total Defense (+2), Sanctified Ward
 * (+4), and Pavis of Elements (+4, never above 18).
 */
export function effectiveAc(c: Combatant): number {
  const ac = Math.max(c.ac, c.acFloor);
  const pavis = c.acBonus > 0 ? Math.max(ac, Math.min(ac + c.acBonus, 18)) : ac;
  return pavis + (c.totalDefense ? 2 : 0) + (c.sanctified ? 4 : 0);
}
