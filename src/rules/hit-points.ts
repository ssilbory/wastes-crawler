// vendor/wwn-srd/2.0 The Rules of the Game/2.7.0 Character Advancement.md (2.7.1.1 Additional Hit Points)
import type { Dice } from '../data/schemas/index.ts';
import { roll } from './dice.ts';
import type { Rng } from './rng.ts';

export const DIE_HARD_BONUS = 2;

export interface HpRollInput {
  /** One die per level held, from progression.hitDiceForLevels. */
  dice: readonly Dice[];
  conModifier: number;
  dieHard: boolean;
  /** 0 for a new character. */
  currentMax: number;
}

/**
 * Rolls every level's die with the Con modifier (and Die Hard) added to each, no die below 1.
 * The new maximum is the roll if it beats the current maximum, otherwise the current maximum + 1.
 */
export function rollMaxHp(
  rng: Rng,
  input: HpRollInput,
): { max: number; rolled: number; perDie: number[] } {
  const bonus = input.conModifier + (input.dieHard ? DIE_HARD_BONUS : 0);
  const perDie = input.dice.map((d) => Math.max(1, roll(rng, d).total + bonus));
  const rolled = perDie.reduce((a, b) => a + b, 0);
  return { max: rolled > input.currentMax ? rolled : input.currentMax + 1, rolled, perDie };
}
