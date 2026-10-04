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

const VITAL_FURNACE = 'vital-furnace';

/** Whether an art works now: armor blocks it unless it is one that works in armor. */
const worksNow = (c: Combatant, art: string) =>
  c.caster !== null && (c.caster.canCast || c.caster.armorFree.includes(art));

/**
 * Vital Furnace (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.9 The Healer.md):
 * Effort for the day negates a wound that leaves the Healer standing; it is spent on any blow of
 * a quarter of their hit points or more (docs/rules-adaptation.md, Phase 14d).
 */
function vitalFurnace(b: Battle, target: Combatant, amount: number): boolean {
  const c = target.caster;
  if (!c?.arts.includes(VITAL_FURNACE) || !worksNow(target, VITAL_FURNACE)) return false;
  if (amount >= target.hp || amount * 4 < target.maxHp || c.effortUsed >= c.effortMax) return false;
  c.effortUsed += 1;
  c.effortDay += 1;
  say(b, `${target.name}'s wound closes at once.`);
  return true;
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
  if (vitalFurnace(b, target, amount)) return;
  target.hp = Math.max(0, target.hp - amount);
  if (target.hp > 0) return;
  if (target.kind === 'monster' || target.frail) {
    target.status = 'dead';
    say(b, `${target.name} dies.`);
  } else if (target.caster?.arts.includes(VITAL_FURNACE) && worksNow(target, VITAL_FURNACE)) {
    // Vital Furnace: a Healer stabilizes on their own at zero (1.5.9.1).
    target.status = 'stable';
    target.fellRound = b.round;
    say(b, `${target.name} falls, but their life burns on.`);
  } else {
    target.status = 'dying';
    target.fellRound = b.round;
    say(b, `${target.name} falls, mortally wounded.`);
  }
}

/** A save with rear-cover advantage and Broken disadvantage. */
export function save(b: Battle, target: Combatant, type: SaveType, modifier = 0): SaveResult {
  const steps = netSteps([covered(b, target) ? 1 : 0, target.strain?.broken ? -1 : 0]);
  const repose = type === 'physical' ? target.reposePenalty : 0;
  return rollSave(b.rng, target.saves[type], { modifier: modifier - repose, steps });
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
