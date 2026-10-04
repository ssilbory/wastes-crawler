// Paying for a mod in loot dice (docs/rules-adaptation.md, Crafting and modifying gear; Sam's calls).
// A cost of 6d6 takes six carried loot dice of six sides or more, smallest first; each die short can
// be paid instead in crowns equal to its highest face, so 2d12 is 24 crowns.

import type { LootDice } from '../data/schemas/index.ts';

export interface DicePayment {
  /** The loot dice left after paying. */
  left: LootDice[];
  /** Dice of the cost not covered by carried dice. */
  short: number;
  /** Crowns that pay for the dice short: the highest face of each. */
  crowns: number;
}

/** Pays `cost` from `loot` as far as it goes, or not at all with `useDice` false. */
export function payDice(loot: readonly LootDice[], cost: LootDice, useDice = true): DicePayment {
  let owed = cost.count;
  const left: LootDice[] = [];
  for (const d of [...loot].sort((a, b) => a.sides - b.sides)) {
    const take = useDice && d.sides >= cost.sides ? Math.min(owed, d.count) : 0;
    owed -= take;
    if (d.count > take) left.push({ count: d.count - take, sides: d.sides });
  }
  return { left, short: owed, crowns: owed * cost.sides };
}
