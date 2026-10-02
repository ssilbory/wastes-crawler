// House rule: docs/rules-adaptation.md, "Advantage / disadvantage".
import { rollDice, rollDie } from './dice.ts';
import type { Rng } from './rng.ts';

export const MAX_STEPS = 2;

/** Sums advantage (+1) and disadvantage (−1) sources, which cancel one for one, capped at ±2. */
export function netSteps(sources: readonly number[]): number {
  const sum = sources.reduce((a, b) => a + b, 0);
  return Math.max(-MAX_STEPS, Math.min(MAX_STEPS, sum));
}

export interface D20Roll {
  /** The d20 face; natural 1 and 20 rules read this. */
  natural: number;
  /** The extra d6s from advantage (added) or disadvantage (subtracted). */
  edgeDice: number[];
  /** natural ± the edge dice, before any other modifier. */
  total: number;
}

/** On attacks and saves, each step of advantage adds 1d6 and each step of disadvantage subtracts 1d6. */
export function rollD20WithEdge(rng: Rng, steps: number): D20Roll {
  const natural = rollDie(rng, 20);
  const edgeDice = rollDice(rng, Math.abs(steps), 6);
  const edge = edgeDice.reduce((a, b) => a + b, 0) * Math.sign(steps);
  return { natural, edgeDice, total: natural + edge };
}

export interface CheckDice {
  dice: number[];
  /** The two dice that count. */
  kept: [number, number];
  total: number;
}

/** On 2d6 checks, each step rolls an extra d6; keep the highest two for advantage, the lowest two for disadvantage. */
export function roll2d6WithEdge(rng: Rng, steps: number): CheckDice {
  const dice = rollDice(rng, 2 + Math.abs(steps), 6);
  const [first, second] = [...dice].sort((a, b) => (steps < 0 ? a - b : b - a)) as [
    number,
    number,
    ...number[],
  ];
  return { dice, kept: [first, second], total: first + second };
}
