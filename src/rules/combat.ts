// vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md (2.4.2 initiative), 2.5.0 Injury,
// Healing, And System Strain.md (2.5.1 mortal injury), 5.0 Monsters and Foes/Morale Checks and
// Fleeing.md (5.3.1), Instinct Checks.md (5.4.1), the Warrior's Killing Blow (1.5.18), and
// 2.6.0 Chases and Pursuit.md (2.6.1 foot chases) for a row that tries to escape (Phase 19).
import { roll2d6WithEdge } from './advantage.ts';
import { rollDie } from './dice.ts';
import type { Rng } from './rng.ts';

/** A side rolls 1d8 plus its best Dex modifier; NPC sides usually add nothing. */
export function sideInitiative(rng: Rng, bestDexModifier: number, bonus = 0): number {
  return rollDie(rng, 8) + bestDexModifier + bonus;
}

/** PC sides win initiative ties. */
export function partyActsFirst(partyRoll: number, enemyRoll: number): boolean {
  return partyRoll >= enemyRoll;
}

/** Morale never rises past 12, at which a creature never breaks (docs/rules-adaptation.md). */
export const MAX_MORALE = 12;

/** 2d6 over the Morale score, plus any bonus, fails: the creature flees or stops fighting. */
export function moraleHolds(rng: Rng, morale: number, bonus = 0): boolean {
  return roll2d6WithEdge(rng, 0).total <= Math.min(MAX_MORALE, morale + bonus);
}

/** SRD 2.6.1: the pursuers' modifier when the fleeing have no head start at all. */
export const NO_HEAD_START = 2;
/** SRD 2.6.1: the pursuers' modifier when they outnumber the pursued. */
export const OUTNUMBERED = -1;

export interface Chase {
  flee: number;
  pursue: number;
  caught: boolean;
}

/**
 * A foot chase from a standing start: each side rolls 2d6 plus its best Exert total, and the
 * pursuers catch the fleeing only by beating their roll; a tie lets them escape.
 */
export function footChase(
  rng: Rng,
  fleeBonus: number,
  pursueBonus: number,
  pursuersOutnumber: boolean,
): Chase {
  const flee = roll2d6WithEdge(rng, 0).total + fleeBonus;
  const modifier = NO_HEAD_START + (pursuersOutnumber ? OUTNUMBERED : 0);
  const pursue = roll2d6WithEdge(rng, 0).total + pursueBonus + modifier;
  return { flee, pursue, caught: pursue > flee };
}

/** 1d10 at or under the Instinct score: the creature acts on impulse instead of tactics. */
export function actsOnInstinct(rng: Rng, instinct: number): boolean {
  return rollDie(rng, 10) <= instinct;
}

/** A Mortally Injured PC dies at the end of the sixth round after falling unless stabilized. */
export const MORTAL_ROUNDS = 6;

/** Stabilizing: difficulty 8 plus full rounds since the fall, +2 without a healer's kit. */
export function stabilizeDifficulty(roundsSinceFall: number, hasKit: boolean): number {
  return 8 + roundsSinceFall + (hasKit ? 0 : 2);
}

/** Killing Blow: half the character level, rounded up, to damage and Shock. */
export function killingBlowBonus(level: number): number {
  return Math.ceil(level / 2);
}
