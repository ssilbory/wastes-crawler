// Damage, falling, and saves in combat: vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury,
// Healing, And System Strain.md (2.5.1: PCs are Mortally Injured at 0 HP and die if Frail; unnamed
// NPCs die), and the rear-cover save advantage in docs/rules-adaptation.md.
import { netSteps } from '../../rules/advantage.ts';
import { rollSave, type SaveResult, type SaveType } from '../../rules/saves.ts';
import { covered } from './targeting.ts';
import type { Battle, Combatant } from './types.ts';

export function say(b: Battle, text: string): void {
  b.log?.push(`Round ${b.round}: ${text}`);
}

/** Applies damage. Sleepers wake; a hit on a dying PC kills them. */
export function harm(b: Battle, target: Combatant, amount: number): void {
  if (amount <= 0) return;
  if (target.status === 'dying') {
    target.status = 'dead';
    say(b, `${target.name} is slain.`);
    return;
  }
  if (target.status === 'asleep') target.status = 'active';
  // Wrath of the Most High falls with the first damage before it lapses (Phase 14c).
  if (target.wrath) {
    if (b.round <= target.wrath.until) amount += target.wrath.bonus;
    target.wrath = null;
  }
  target.hp = Math.max(0, target.hp - amount);
  if (target.hp > 0) return;
  if (target.kind === 'monster' || target.frail) {
    target.status = 'dead';
    say(b, `${target.name} dies.`);
  } else {
    target.status = 'dying';
    target.fellRound = b.round;
    say(b, `${target.name} falls, mortally wounded.`);
  }
}

/** A save with rear-cover advantage and Broken disadvantage. */
export function save(b: Battle, target: Combatant, type: SaveType, modifier = 0): SaveResult {
  const steps = netSteps([covered(b, target) ? 1 : 0, target.strain?.broken ? -1 : 0]);
  return rollSave(b.rng, target.saves[type], { modifier, steps });
}

/**
 * AC with Armor of God's natural AC if better, Total Defense (+2), and Pavis of Elements (+4,
 * never above 18).
 */
export function effectiveAc(c: Combatant): number {
  const ac = Math.max(c.ac, c.acFloor);
  const pavis = c.acBonus > 0 ? Math.max(ac, Math.min(ac + c.acBonus, 18)) : ac;
  return pavis + (c.totalDefense ? 2 : 0);
}
