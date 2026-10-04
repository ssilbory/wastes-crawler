// The town shop and loot exchange (docs/rules-adaptation.md, Progression and economy): SRD prices
// (vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/) with the spending-threshold surcharge, gear
// sold back for a fixed fraction, and loot dice rolled into crowns against the loot threshold.
import type { ItemLocation, LootDice, People } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import { lootPayout, toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import { inventoryErrors } from '../character/equipment.ts';
import { sizeEntries } from '../character/gear.ts';
import { entryPrice, findItem, type InventoryEntry } from '../character/items.ts';
import { findPeople } from '../character/people.ts';
import { note } from './members.ts';
import { currentLedger, ledger, priceHere, spend, spendingThreshold, townHere } from './town.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

function member(w: World, id: string): Member {
  const m = w.members.find((x) => x.id === id && !x.dead);
  if (!m) throw new Error(`no living party member ${id}`);
  return m;
}

/** Saved characters are checked against the content when loaded, so their people exists. */
const peopleOf = (data: GameData, m: Member) => findPeople(data, m.character.people) as People;

/** One unit's listed price in crowns. */
export function listedPrice(data: GameData, itemId: string): number {
  const item = findItem(data, itemId);
  if (!item?.cost) throw new Error(`${itemId} isn't for sale`);
  return entryPrice(data, item, { id: itemId, quantity: 1, location: 'stowed' }) / 10;
}

/** What one unit costs in this town today. */
export const shopPrice = (w: World, data: GameData, itemId: string) =>
  priceHere(w, data, listedPrice(data, itemId));

/** Checks a changed inventory: worn and readied limits, sizing, and not too heavy to move. */
export function inventoryProblem(
  data: GameData,
  m: Member,
  inventory: InventoryEntry[],
): string | null {
  const c = m.character;
  const errors = inventoryErrors(data, inventory, peopleOf(data, m));
  if (errors.length > 0) return errors.join('; ');
  const { load } = characterSheet({ ...c, inventory }, data).equipment;
  return load.state === 'too-heavy' ? `${c.name} can't carry that much` : null;
}

/** Merges a bought unit into a matching stowed line, or adds one. */
function addUnit(inventory: InventoryEntry[], entry: InventoryEntry): InventoryEntry[] {
  const same = inventory.findIndex(
    (e) =>
      e.id === entry.id &&
      e.location === 'stowed' &&
      e.small === entry.small &&
      e.barding === entry.barding,
  );
  if (same < 0) return [...inventory, entry];
  return inventory.map((e, i) => (i === same ? { ...e, quantity: e.quantity + 1 } : e));
}

export function buy(w: World, data: GameData, memberId: string, itemId: string): TownResult {
  const m = member(w, memberId);
  const item = [{ id: itemId, quantity: 1, location: 'stowed' as const }];
  const [entry] = sizeEntries(data, item, peopleOf(data, m));
  const inventory = addUnit(m.character.inventory, entry as InventoryEntry);
  const problem = inventoryProblem(data, m, inventory);
  if (problem) return no(problem);
  const price = shopPrice(w, data, itemId);
  if (!spend(w, data, listedPrice(data, itemId))) return no(`That costs ${price} crowns.`);
  m.character = { ...m.character, inventory };
  return { ok: true };
}

/** What one unit of an inventory line sells for. */
export function sellPrice(data: GameData, entry: InventoryEntry): number {
  const item = findItem(data, entry.id);
  if (!item?.cost) return 0;
  const one = entryPrice(data, item, { ...entry, quantity: 1 }) / 10;
  return toTenths(one * data.content.townRules.sellFraction);
}

export function sell(w: World, data: GameData, memberId: string, index: number): TownResult {
  townHere(w, data);
  const m = member(w, memberId);
  const entry = m.character.inventory[index];
  if (!entry) throw new Error(`no inventory line ${index}`);
  const price = sellPrice(data, entry);
  if (price === 0) return no('No one here will buy that.');
  const inventory =
    entry.quantity > 1
      ? m.character.inventory.map((e, i) => (i === index ? { ...e, quantity: e.quantity - 1 } : e))
      : m.character.inventory.filter((_, i) => i !== index);
  m.character = { ...m.character, inventory };
  w.purse = toTenths(w.purse + price);
  return { ok: true };
}

/** Moves an inventory line between worn, readied, and stowed. */
export function setLocation(
  w: World,
  data: GameData,
  memberId: string,
  index: number,
  location: ItemLocation,
): TownResult {
  const m = member(w, memberId);
  const inventory = m.character.inventory.map((e, i) => (i === index ? { ...e, location } : e));
  const problem = inventoryProblem(data, m, inventory);
  if (problem) return no(problem);
  m.character = { ...m.character, inventory };
  return { ok: true };
}

/** Hands one unit of an inventory line to another living party member. */
export function giveItem(
  w: World,
  data: GameData,
  fromId: string,
  index: number,
  toId: string,
): TownResult {
  const from = member(w, fromId);
  const to = member(w, toId);
  const entry = from.character.inventory[index];
  if (!entry) throw new Error(`no inventory line ${index}`);
  const received = addUnit(to.character.inventory, { ...entry, quantity: 1, location: 'stowed' });
  const problem = inventoryProblem(data, to, received);
  if (problem) return no(problem);
  from.character = {
    ...from.character,
    inventory:
      entry.quantity > 1
        ? from.character.inventory.map((e, i) =>
            i === index ? { ...e, quantity: e.quantity - 1 } : e,
          )
        : from.character.inventory.filter((_, i) => i !== index),
  };
  to.character = { ...to.character, inventory: received };
  return { ok: true };
}

/** Adds loot dice, keeping one entry per die size. */
export function addLoot(w: World, dice: readonly LootDice[]): void {
  for (const d of dice) {
    const same = w.loot.find((l) => l.sides === d.sides);
    if (same) same.count += d.count;
    else w.loot.push({ ...d });
  }
  w.loot.sort((a, b) => a.sides - b.sides);
}

/** Rolls every loot die carried and pays out against the town's loot threshold. */
export function exchangeLoot(w: World, data: GameData): { rolled: number; paid: number } {
  const town = townHere(w, data);
  if (w.loot.length === 0) return { rolled: 0, paid: 0 };
  const rules = data.content.townRules;
  const rolled = w.loot.reduce(
    (sum, d) => sum + roll(w.rng, { count: d.count, sides: d.sides, modifier: 0 }).total,
    0,
  );
  const threshold = spendingThreshold(data, town) * rules.lootThresholdFraction;
  const paid = lootPayout(
    currentLedger(w, data, town).looted,
    rolled,
    threshold,
    rules.lootDropRate,
  );
  ledger(w, data, town).looted += rolled;
  w.purse = toTenths(w.purse + paid);
  w.loot = [];
  note(w, `The loot is worth ${rolled} crowns; ${town.name}'s traders pay ${paid}.`);
  return { rolled, paid };
}
