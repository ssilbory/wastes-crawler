// Potion drops (docs/rules-adaptation.md, Potions: Drops; Sam's calls): a won boss fight that pays
// XP leaves a potion 30% of the time, and any other such fight against humanoids 1% of the time.
// Three drops in ten are scrolls instead (Scrolls): a spell the party's level could cast, at its
// level. A potion is one of the brewable potions by its recipe weight. The find goes to the PC with
// the most room, or is left behind if it would leave them too heavy. It costs none of the loot dice.
import { pickWeighted } from '../../rules/gear-drops.ts';
import type { GameData } from '../character/context.ts';
import { findItem, lineLabel, type InventoryEntry } from '../character/items.ts';
import { putLine } from '../character/stacks.ts';
import { partyLevel } from './difficulty.ts';
import { keeper, type DropContext } from './gear-drops.ts';
import { scribable } from './scribing.ts';
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

/** A scroll of a spell the party's level could cast (SRD 4.2.0: up to half the level, rounded
 * up, at most 5), at the party's level. */
function scrollDrop(w: World, data: GameData): InventoryEntry {
  const level = partyLevel(w, data);
  const max = Math.min(5, Math.ceil(level / 2));
  const spells = scribable(data).filter((s) => s.level <= max);
  const spell = spells[w.rng.int(0, spells.length - 1)] as (typeof spells)[number];
  const scroll = data.content.scrolls.scroll.id;
  return { id: scroll, quantity: 1, location: 'stowed', spell: spell.id, casterLevel: level };
}

/** A potion by recipe weight, or null when no recipe drops. */
function potionDrop(w: World, data: GameData): InventoryEntry | null {
  const recipes = data.content.alchemy.recipes.filter(
    (r) => r.weight > 0 && findItem(data, r.item)?.kind === 'potion',
  );
  if (recipes.length === 0) return null;
  const id = pickWeighted(
    w.rng,
    recipes.map((r) => [r.item, r.weight] as const),
  );
  return { id, quantity: 1, location: 'stowed' };
}

export function dropPotion(
  w: World,
  data: GameData,
  enemies: readonly string[],
  ctx: DropContext,
): void {
  const chance = potionChance(data, enemies, ctx);
  if (chance === 0 || w.rng.int(1, 100) > chance) return;
  const scroll = w.rng.int(1, 100) <= data.content.scrolls.dropShare;
  const entry = scroll ? scrollDrop(w, data) : potionDrop(w, data);
  if (!entry) return;
  const name = lineLabel(data, entry);
  const m = keeper(w, data);
  if (!m) return;
  const before = m.character;
  const inventory = putLine(before.inventory, entry);
  m.character = { ...before, inventory };
  if (memberSheet(data, m).equipment.load.state === 'too-heavy') {
    m.character = before;
    note(w, `Too laden to carry it, the party leaves behind a ${name}.`);
    return;
  }
  note(w, `${m.character.name} finds a ${name} among the fallen.`);
}
