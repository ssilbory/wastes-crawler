// Potion drops (docs/rules-adaptation.md, Potions: Drops; Sam's calls): a won boss fight that pays
// XP leaves a potion 30% of the time, and any other such fight against humanoids 1% of the time.
// The potion is one of the brewable potions by its recipe weight, and goes to the PC with the most
// room, or is left behind if it would leave them too heavy. It costs none of the loot dice.
import { pickWeighted } from '../../rules/gear-drops.ts';
import type { GameData } from '../character/context.ts';
import { findItem } from '../character/items.ts';
import { putLine } from '../character/stacks.ts';
import { keeper, type DropContext } from './gear-drops.ts';
import { memberSheet, note } from './members.ts';
import type { World } from './types.ts';

const humanoid = (data: GameData, id: string) =>
  data.content.monsterCombat.find((m) => m.id === id)?.tags.includes('humanoid') === true;

/** The percent chance the fight drops a potion. */
export function potionChance(data: GameData, enemies: readonly string[], ctx: DropContext): number {
  const odds = data.content.alchemy.drops;
  if (ctx.xp <= 0) return 0;
  if (ctx.boss) return odds.boss;
  return enemies.some((id) => humanoid(data, id)) ? odds.humanoid : 0;
}

export function dropPotion(
  w: World,
  data: GameData,
  enemies: readonly string[],
  ctx: DropContext,
): void {
  const chance = potionChance(data, enemies, ctx);
  if (chance === 0 || w.rng.int(1, 100) > chance) return;
  const recipes = data.content.alchemy.recipes.filter(
    (r) => r.weight > 0 && findItem(data, r.item)?.kind === 'potion',
  );
  if (recipes.length === 0) return;
  const id = pickWeighted(
    w.rng,
    recipes.map((r) => [r.item, r.weight] as const),
  );
  const name = (findItem(data, id) as { name: string }).name;
  const m = keeper(w, data);
  if (!m) return;
  const before = m.character;
  const inventory = putLine(before.inventory, { id, quantity: 1, location: 'stowed' });
  m.character = { ...before, inventory };
  if (memberSheet(data, m).equipment.load.state === 'too-heavy') {
    m.character = before;
    note(w, `Too laden to carry it, the party leaves behind a ${name}.`);
    return;
  }
  note(w, `${m.character.name} finds a ${name} among the fallen.`);
}
