// Gear carried for the party (docs/rules-adaptation.md, NPCs in Phase 6c and Mounts): a porter's
// load (vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.3.0 Hirelings and Services.md), and a
// pack beast's or mount's (2.0 The Rules of the Game/2.12.0, 2.12.3). Mounts wait above ground, so
// their loads can't be reached underground.
import type { GameData } from '../character/context.ts';
import type { InventoryEntry } from '../character/items.ts';
import { hirelingType } from './npcs.ts';
import { load, mountCapacity, mountType } from './mounts.ts';
import type { TownResult } from './services.ts';
import { inventoryProblem } from './shop.ts';
import type { Mount, Npc, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export interface Carrier {
  holder: Npc | Mount;
  kind: 'porter' | 'pack' | 'mount';
  capacity: number;
}

/** Everyone who can carry gear for the party here: porters, pack beasts, and mounts above ground. */
export function carriers(w: World, data: GameData): Carrier[] {
  const npcs = w.npcs.flatMap((n): Carrier[] => {
    if (n.kind === 'pack')
      return [{ holder: n, kind: 'pack', capacity: mountType(data, n.type).loadUnridden }];
    if (n.kind === 'hireling' && hirelingType(data, n.type).role === 'porter')
      return [{ holder: n, kind: 'porter', capacity: data.content.npcRules.porterCapacity }];
    return [];
  });
  const mounts = w.dungeon
    ? []
    : w.mounts.map((m): Carrier => ({
        holder: m,
        kind: 'mount',
        capacity: mountCapacity(w, data, m),
      }));
  return [...npcs, ...mounts];
}

function carrier(w: World, data: GameData, id: string): Carrier {
  const c = carriers(w, data).find((x) => x.holder.id === id);
  if (!c) throw new Error(`no carrier ${id}`);
  return c;
}

export function takeOne(entries: InventoryEntry[], index: number): InventoryEntry[] {
  const e = entries[index] as InventoryEntry;
  return e.quantity > 1
    ? entries.map((x, i) => (i === index ? { ...x, quantity: x.quantity - 1 } : x))
    : entries.filter((_, i) => i !== index);
}

export function addOne(entries: InventoryEntry[], entry: InventoryEntry): InventoryEntry[] {
  const unit = { ...entry, quantity: 1, location: 'stowed' as const };
  const same = entries.findIndex(
    (e) => e.id === unit.id && e.small === unit.small && e.barding === unit.barding,
  );
  if (same < 0) return [...entries, unit];
  return entries.map((e, i) => (i === same ? { ...e, quantity: e.quantity + 1 } : e));
}

/** Hands one unit from a party member to a carrier, within what it can carry. */
export function stowWith(
  w: World,
  data: GameData,
  memberId: string,
  index: number,
  carrierId: string,
): TownResult {
  const c = carrier(w, data, carrierId);
  const m = w.members.find((x) => x.id === memberId && !x.dead);
  const entry = m?.character.inventory[index];
  if (!m || !entry) throw new Error(`no item ${index} on ${memberId}`);
  const carried = addOne(c.holder.inventory, entry);
  if (load(data, { inventory: carried }) > c.capacity)
    return no(`${c.holder.name} can't carry any more.`);
  c.holder.inventory = carried;
  m.character = { ...m.character, inventory: takeOne(m.character.inventory, index) };
  return { ok: true };
}

/** Takes one unit back from a carrier, if the member can carry it. */
export function takeFrom(
  w: World,
  data: GameData,
  carrierId: string,
  index: number,
  memberId: string,
): TownResult {
  const c = carrier(w, data, carrierId);
  const m = w.members.find((x) => x.id === memberId && !x.dead);
  const entry = c.holder.inventory[index];
  if (!m || !entry) throw new Error(`no item ${index} on ${carrierId}`);
  const inventory = addOne(m.character.inventory, entry);
  const problem = inventoryProblem(data, m, inventory);
  if (problem) return no(problem);
  m.character = { ...m.character, inventory };
  c.holder.inventory = takeOne(c.holder.inventory, index);
  return { ok: true };
}
