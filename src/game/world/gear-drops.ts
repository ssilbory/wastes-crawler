// Weapons and armor beaten humanoids leave behind (docs/rules-adaptation.md, Gear drops; Sam's
// calls). Only a won fight that pays XP drops one, and only from humanoids that drop no crafting
// components. The tier follows the party's level (vendor/wwn-srd/2.0 The Rules of the Game/2.8.0
// Crafting and Modifying Gear.md, 2.8.1); boss fights can drop a magic one instead (4.0 Magic and
// Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.3). A fight that drops nothing
// else may still leave a fine weapon: mastercrafted, +1, or +2.
import { allMonsters, baseMonster } from '../../data/monsters.ts';
import {
  bandAt,
  dropTier,
  fineFind,
  pickWeighted,
  type DropTier,
  type FineFind,
} from '../../rules/gear-drops.ts';
import type { GameData } from '../character/context.ts';
import { fitSize, sizedLine } from '../character/gear.ts';
import {
  entryPrice,
  findItem,
  lineLabel,
  type CatalogItem,
  type InventoryEntry,
} from '../character/items.ts';
import { findPeople } from '../character/people.ts';
import type { People } from '../../data/schemas/index.ts';
import { partyLevel } from './difficulty.ts';
import { alive, memberSheet, note } from './members.ts';
import type { Member, World } from './types.ts';

/** What the fight was worth, for deciding whether anything drops. */
export interface DropContext {
  /** XP each PC earns for the win; a fight worth none drops nothing. */
  xp: number;
  /** A quest's fixed fight or a vault's guards, which can drop magic. */
  boss: boolean;
}

type Body = Extract<CatalogItem, { kind: 'armor' }>;

/** Humanoids that drop no components: the only ones that leave their gear. */
export function dropsGear(data: GameData, id: string): boolean {
  const combat = data.content.monsterCombat.find((m) => m.id === id);
  if (!combat?.tags.includes('humanoid')) return false;
  const base = baseMonster(data.content, id);
  return !data.content.components.some((c) => c.sources.some((s) => s.monster === base));
}

/** Body armor with a price, cheapest first so a tie on AC goes to the plainer suit. */
const suits = (data: GameData): Body[] =>
  data.srd.armor
    .filter((a) => a.category !== 'shield' && a.cost)
    .map((a) => findItem(data, a.id) as Body)
    .sort((a, b) => entryPrice(data, a, one(a.id)) - entryPrice(data, b, one(b.id)));

const one = (id: string): InventoryEntry => ({ id, quantity: 1, location: 'stowed' });

/** The armor a stat line's armored AC comes from: the best suit at or under it. */
function armorFor(data: GameData, ac: number, late: boolean): Body | undefined {
  const lateArmor = data.content.craftingRules.drops.lateArmor;
  const fits = suits(data).filter((s) => s.armor.ac <= ac && (late || !lateArmor.includes(s.id)));
  return fits.reduce<Body | undefined>(
    (a, b) => (!a || b.armor.ac > a.armor.ac ? b : a),
    undefined,
  );
}

/** A priced weapon: the enemy's own, else any from the SRD. */
function weaponFor(w: World, data: GameData, id: string): CatalogItem {
  const own = data.content.monsterCombat.find((m) => m.id === id)?.weapon;
  const item = own ? findItem(data, own) : undefined;
  if (item?.cost) return item;
  const priced = data.srd.weapons.filter((x) => x.cost);
  return findItem(
    data,
    (priced[w.rng.int(0, priced.length - 1)] as { id: string }).id,
  ) as CatalogItem;
}

/** The weapon or armor one beaten enemy leaves; `late` lets the costly armors drop. */
function itemFrom(w: World, data: GameData, id: string, late: boolean): CatalogItem {
  const line = allMonsters(data.srd, data.content).find((m) => m.id === id);
  const suit = line?.armored ? armorFor(data, line.ac, late) : undefined;
  return suit && w.rng.int(1, 2) === 1 ? suit : weaponFor(w, data, id);
}

/** The living, conscious PC with the most spare Stowed room. */
export function keeper(w: World, data: GameData): Member | undefined {
  const room = (m: Member) => {
    const l = memberSheet(data, m).equipment.load;
    return l.stowedLimit - l.stowed;
  };
  return alive(w)
    .filter((m) => m.character.hp.current > 0)
    .reduce<Member | undefined>((a, b) => (!a || room(b) > room(a) ? b : a), undefined);
}

/**
 * Rolls for a weapon or suit of armor from the beaten enemies and gives it to the PC with the most
 * room. Returns its value in crowns, so the loot dice can be cut for it, or 0 if nothing dropped.
 */
export function dropGear(
  w: World,
  data: GameData,
  enemies: readonly string[],
  ctx: DropContext,
): number {
  if (ctx.xp <= 0) return 0;
  const from = enemies.filter((id) => dropsGear(data, id));
  if (from.length === 0) return 0;
  const rules = data.content.craftingRules.drops;
  const magic = ctx.boss && w.rng.int(1, 100) <= rules.magicChance;
  const ordinary = magic || w.rng.int(1, 100) <= rules.chance;
  const fine: FineFind | undefined =
    !ordinary && w.rng.int(1, 100) <= rules.fine.chance
      ? fineFind(w.rng, rules.fine.weights)
      : undefined;
  if (!ordinary && !fine) return 0;
  const level = partyLevel(w, data);
  const enemy = from[w.rng.int(0, from.length - 1)] as string;
  if (fine) return give(w, data, weaponFor(w, data, enemy), fine.quality, fine.bonus);
  // A magic item is of normal make; the costly armors come only where mastercrafted gear could.
  const tier: DropTier = magic ? 'normal' : dropTier(w.rng, rules.bands, level);
  const late = magic
    ? bandAt(rules.bands, level).weights.mastercrafted > 0
    : tier === 'mastercrafted';
  const item = itemFrom(w, data, enemy, late);
  const quality = rules.lateArmor.includes(item.id) || tier === 'normal' ? undefined : tier;
  const tiers = data.content.craftingRules.magic.tiers;
  const bonus = magic
    ? pickWeighted(
        w.rng,
        tiers.map((t) => [t.bonus, t.weight] as const),
      )
    : 0;
  // A quarter of magic finds carry a special ability that fits them (Abilities, Sam's call).
  const fits = data.content.forging.abilities.filter((a) =>
    a.targets.includes(item.kind === 'armor' ? 'armor' : 'weapon'),
  );
  const ability =
    magic && w.rng.int(1, 100) <= data.content.forging.dropAbilityChance
      ? (fits[w.rng.int(0, fits.length - 1)] as (typeof fits)[number]).id
      : undefined;
  return give(w, data, item, quality, bonus, ability);
}

/** Hands a dropped item to the PC with the most room; its value in crowns, or 0 if left behind. */
function give(
  w: World,
  data: GameData,
  item: CatalogItem,
  quality: Exclude<DropTier, 'normal'> | undefined,
  bonus: number,
  ability?: string,
): number {
  const m = keeper(w, data);
  if (!m) return 0;
  const people = findPeople(data, m.character.people) as People;
  const entry = sizedLine(
    data,
    {
      ...one(item.id),
      ...(quality ? { quality } : {}),
      ...(bonus ? { bonus } : {}),
      ...(ability ? { ability } : {}),
    },
    fitSize(people),
  );
  const label = lineLabel(data, entry);
  const before = m.character;
  m.character = { ...before, inventory: [...before.inventory, entry] };
  // Like any gift of gear, the keeper must be able to carry it.
  if (memberSheet(data, m).equipment.load.state === 'too-heavy') {
    m.character = before;
    note(w, `Too laden to carry it, the party leaves behind the ${label}.`);
    return 0;
  }
  note(w, `${m.character.name} takes the ${label} from the fallen.`);
  return entryPrice(data, item, entry) / 10;
}
