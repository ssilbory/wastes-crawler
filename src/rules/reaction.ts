// vendor/wwn-srd/5.0 Monsters and Foes/Reaction Rolls and Parlayeing.md (5.2.1): 2d6 plus the
// greeting PC's Charisma modifier.
import { rollDice } from './dice.ts';
import type { Rng } from './rng.ts';

export type Reaction = 'aggressive' | 'unfriendly' | 'expected' | 'friendly' | 'helpful';

export function reactionFor(total: number): Reaction {
  if (total <= 2) return 'aggressive';
  if (total <= 5) return 'unfriendly';
  if (total <= 8) return 'expected';
  if (total <= 11) return 'friendly';
  return 'helpful';
}

export function reactionRoll(rng: Rng, chaModifier: number): { total: number; reaction: Reaction } {
  const total = rollDice(rng, 2, 6).reduce((a, b) => a + b, 0) + chaModifier;
  return { total, reaction: reactionFor(total) };
}
