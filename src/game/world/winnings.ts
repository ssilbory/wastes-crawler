// What a won fight pays (docs/rules-adaptation.md, Loot dice): loot dice, components, and an
// animal's rations, with hirelings' shares taken as the dice are won.
import type { GameData } from '../character/context.ts';
import { butcher } from './butcher.ts';
import { componentDrops } from './components.ts';
import { note } from './members.ts';
import { accrueShares } from './npcs.ts';
import { addLoot } from './shop.ts';
import type { World } from './types.ts';

/** The loot dice and components the defeated enemies drop (docs/rules-adaptation.md, Loot dice). */
export function winnings(w: World, data: GameData, enemies: readonly (readonly string[])[]): void {
  const dice = enemies.flatMap((row) =>
    row.flatMap((id) => {
      const loot = data.content.monsterCombat.find((m) => m.id === id)?.loot;
      return loot ? [loot] : [];
    }),
  );
  componentDrops(w, data, enemies.flat());
  butcher(w, data, enemies.flat());
  if (dice.length === 0) return;
  addLoot(w, dice);
  accrueShares(w, data, dice);
  const total = new Map<number, number>();
  for (const d of dice) total.set(d.sides, (total.get(d.sides) ?? 0) + d.count);
  const text = [...total].map(([sides, count]) => `${count}d${sides}`).join(' + ');
  note(w, `The party takes ${text} of loot.`);
}
