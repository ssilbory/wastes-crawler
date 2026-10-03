// vendor/wwn-srd/2.0 The Rules of the Game/2.3.0 Skill Checks.md
// plus the Advantage / disadvantage and Push house rules in docs/rules-adaptation.md.
import { roll2d6WithEdge, type CheckDice } from './advantage.ts';
import type { Rng } from './rng.ts';
import { addStrain, type StrainOutcome, type StrainState } from './strain.ts';

export const UNTRAINED_PENALTY = -1;

export interface SkillCheckInput {
  /** Skill level 0–4, or null when the character lacks even level-0. */
  skill: number | null;
  attributeModifier: number;
  difficulty: number;
  /** Situational modifiers, aid, gear, and magic. */
  modifier?: number;
  /** Net advantage steps from advantage.netSteps. */
  steps?: number;
}

export interface CheckResult extends CheckDice {
  /** Dice plus every modifier. */
  score: number;
  success: boolean;
  /** A check can be pushed only once. */
  pushed: boolean;
}

function resolve(dice: CheckDice, bonus: number, difficulty: number): CheckResult {
  const score = dice.total + bonus;
  return { ...dice, score, success: score >= difficulty, pushed: false };
}

export function skillCheck(rng: Rng, input: SkillCheckInput): CheckResult {
  const skill = input.skill ?? UNTRAINED_PENALTY;
  const bonus = skill + input.attributeModifier + (input.modifier ?? 0);
  return resolve(roll2d6WithEdge(rng, input.steps ?? 0), bonus, input.difficulty);
}

export interface NpcCheckInput {
  /** The stat line's Skill bonus when the action suits the NPC; otherwise 0, or −1 if it's ill-suited. */
  skillBonus: number;
  difficulty: number;
  modifier?: number;
  steps?: number;
}

export function npcCheck(rng: Rng, input: NpcCheckInput): CheckResult {
  const bonus = input.skillBonus + (input.modifier ?? 0);
  return resolve(roll2d6WithEdge(rng, input.steps ?? 0), bonus, input.difficulty);
}

/** In an opposed check the higher score wins, and the PC wins ties. */
export function pcWinsOpposed(pcScore: number, opponentScore: number): boolean {
  return pcScore >= opponentScore;
}

/** Any number of successful aiders grant a total of +1. */
export function aidBonus(aidSucceeded: readonly boolean[]): number {
  return aidSucceeded.some(Boolean) ? 1 : 0;
}

export type PushResult =
  | { kind: 'pushed'; result: CheckResult; strain: StrainState }
  | { kind: 'refused'; reason: 'broken' | 'over-max' | 'not-failed' | 'already-pushed' };

/**
 * Rerolls a failed check once, for 1 System Strain. A Broken character, or one at maximum strain,
 * can't push. If the push breaks the character, Broken applies to later rolls, not this reroll.
 */
export function pushCheck(
  rng: Rng,
  input: SkillCheckInput,
  failed: CheckResult,
  strain: StrainState,
): PushResult {
  if (failed.success) return { kind: 'refused', reason: 'not-failed' };
  if (failed.pushed) return { kind: 'refused', reason: 'already-pushed' };
  const outcome: StrainOutcome = addStrain(strain, 1, 'push');
  if (outcome.kind === 'refused') return { kind: 'refused', reason: outcome.reason };
  return {
    kind: 'pushed',
    result: { ...skillCheck(rng, input), pushed: true },
    strain: outcome.state,
  };
}
