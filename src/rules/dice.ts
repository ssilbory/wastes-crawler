import type { Dice } from '../data/schemas/index.ts';
import type { Rng } from './rng.ts';

export interface DiceRoll {
  total: number;
  /** Each die's face, before the modifier. */
  dice: number[];
}

export function rollDie(rng: Rng, sides: number): number {
  return rng.int(1, sides);
}

export function rollDice(rng: Rng, count: number, sides: number): number[] {
  return Array.from({ length: count }, () => rollDie(rng, sides));
}

export function roll(rng: Rng, expr: Dice): DiceRoll {
  const dice = rollDice(rng, expr.count, expr.sides);
  return { total: dice.reduce((a, b) => a + b, 0) + expr.modifier, dice };
}

export function maxRoll(expr: Dice): number {
  return expr.count * expr.sides + expr.modifier;
}
