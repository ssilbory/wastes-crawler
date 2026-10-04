// The Resource dice house rule in docs/rules-adaptation.md: supplies tracked as a die that steps
// down from d12 to d4 on a roll of 1 or 2, and is gone after stepping below d4.
import { rollDie } from './dice.ts';
import type { Rng } from './rng.ts';

/** Die sizes from empty (0) to the largest. */
export const RESOURCE_DICE = [0, 4, 6, 8, 10, 12] as const;
export type ResourceDie = (typeof RESOURCE_DICE)[number];

/** Steps a die up (positive) or down (negative), staying between empty and d12. */
export function stepDie(die: ResourceDie, steps: number): ResourceDie {
  const index = RESOURCE_DICE.indexOf(die) + steps;
  return RESOURCE_DICE[Math.max(0, Math.min(RESOURCE_DICE.length - 1, index))] as ResourceDie;
}

export interface ResourceUse {
  /** False when the die was already gone and nothing could be used. */
  available: boolean;
  roll: number | null;
  die: ResourceDie;
}

/** Rolls the die for one use; a 1 or 2 steps it down. */
export function useResource(rng: Rng, die: ResourceDie): ResourceUse {
  if (die === 0) return { available: false, roll: null, die };
  const roll = rollDie(rng, die);
  return { available: true, roll, die: roll <= 2 ? stepDie(die, -1) : die };
}
