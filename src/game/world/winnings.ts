// What a won fight pays: the defeated enemies' loot dice (docs/rules-adaptation.md, Loot dice),
// their components, the butcher's cuts, and now and then a weapon or suit of armor (Gear drops),
// which costs some of the dice; hirelings take their shares as the dice are won.
import { cutLoot } from '../../rules/gear-drops.ts';
import type { GameData } from '../character/context.ts';
import { butcher } from './butcher.ts';
import { componentDrops } from './components.ts';
import { dropGear, type DropContext } from './gear-drops.ts';
import { note } from './members.ts';
import { accrueShares } from './npcs.ts';
import { pickUp } from './party-load.ts';
import { addLoot } from './shop.ts';
import type { World } from './types.ts';

/**
 * The loot dice and components the defeated enemies drop (docs/rules-adaptation.md, Loot dice).
 * Given what the fight was worth, humanoids may also drop gear (Gear drops).
 */
export function winnings(
  w: World,
  data: GameData,
  enemies: readonly (readonly string[])[],
  worth?: DropContext,
): void {
  const won = enemies.flatMap((row) =>
    row.flatMap((id) => {
      const loot = data.content.monsterCombat.find((m) => m.id === id)?.loot;
      return loot ? [loot] : [];
    }),
  );
  butcher(w, data, enemies.flat());
  // The item comes first, so the dice picked up after it feel its weight.
  const value = worth ? dropGear(w, data, enemies.flat(), worth) : 0;
  const dice = value > 0 ? cutLoot(won, value, data.content.craftingRules.drops.lootKept) : won;
  // What the party can't carry is left behind (Party stash).
  const kept = pickUp(w, data, () => {
    componentDrops(w, data, enemies.flat());
    addLoot(w, dice);
  });
  if (kept.length === 0) return;
  accrueShares(w, data, kept);
  const total = new Map<number, number>();
  for (const d of kept) total.set(d.sides, (total.get(d.sides) ?? 0) + d.count);
  const text = [...total].map(([sides, count]) => `${count}d${sides}`).join(' + ');
  note(w, `The party takes ${text} of loot.`);
}
