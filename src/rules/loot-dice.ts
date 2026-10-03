// Paying for a mod in loot dice (docs/rules-adaptation.md, Crafting and modifying gear; Sam's call:
// exact dice). A cost of 6d6 takes six carried loot dice of six sides or more, smallest first.
import type { LootDice } from '../data/schemas/index.ts';

/** The loot dice left after paying `cost`, or null if the party doesn't carry enough. */
export function payDice(loot: readonly LootDice[], cost: LootDice): LootDice[] | null {
  let owed = cost.count;
  const left: LootDice[] = [];
  for (const d of [...loot].sort((a, b) => a.sides - b.sides)) {
    const take = d.sides >= cost.sides ? Math.min(owed, d.count) : 0;
    owed -= take;
    if (d.count > take) left.push({ count: d.count - take, sides: d.sides });
  }
  return owed > 0 ? null : left;
}
