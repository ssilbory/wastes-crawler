// Hiring and dismissing NPCs, and a porter's load (docs/rules-adaptation.md, NPCs in Phase 6c;
// vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.3.0 Hirelings and Services.md).
import type { GameData } from '../character/context.ts';
import {
  entryEncumbrance,
  findItem,
  type CatalogItem,
  type InventoryEntry,
} from '../character/items.ts';
import { note } from './members.ts';
import { addNpc, hirelingType, MAX_NPCS, removeNpc } from './npcs.ts';
import type { TownResult } from './services.ts';
import { inventoryProblem } from './shop.ts';
import { townHere } from './town.ts';
import type { Npc, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Hires in town; the first night's wage comes due at the end of the day. */
export function hire(w: World, data: GameData, typeId: string): TownResult {
  townHere(w, data);
  if (w.encounter) return no('Settle the encounter first.');
  const t = hirelingType(data, typeId);
  const npc = addNpc(w, data, 'hireling', t.id, t.monster, null, t.role === 'fighter');
  if (!npc) return no(`The party has room for ${MAX_NPCS} NPCs.`);
  note(w, `${npc.name} signs on as a ${t.name} for ${t.wage} crowns a day.`);
  return { ok: true };
}

/** Sends an NPC away anywhere; a captive left behind is abandoned. */
export function dismiss(w: World, id: string): TownResult {
  const n = w.npcs.find((x) => x.id === id);
  if (!n) throw new Error(`no NPC ${id}`);
  if (n.inventory.length > 0) return no(`Take ${n.name}'s load first.`);
  removeNpc(w, id);
  note(w, n.kind === 'captive' ? `The party leaves ${n.name} behind.` : `${n.name} is let go.`);
  return { ok: true };
}

const porter = (w: World, data: GameData, id: string): Npc => {
  const n = w.npcs.find((x) => x.id === id);
  if (n?.kind !== 'hireling' || hirelingType(data, n.type).role !== 'porter')
    throw new Error(`no porter ${id}`);
  return n;
};

const load = (data: GameData, entries: readonly InventoryEntry[]) =>
  entries.reduce(
    (sum, e) => sum + entryEncumbrance(data, findItem(data, e.id) as CatalogItem, e),
    0,
  );

function takeOne(entries: InventoryEntry[], index: number): InventoryEntry[] {
  const e = entries[index] as InventoryEntry;
  return e.quantity > 1
    ? entries.map((x, i) => (i === index ? { ...x, quantity: x.quantity - 1 } : x))
    : entries.filter((_, i) => i !== index);
}

function addOne(entries: InventoryEntry[], entry: InventoryEntry): InventoryEntry[] {
  const unit = { ...entry, quantity: 1, location: 'stowed' as const };
  const same = entries.findIndex(
    (e) => e.id === unit.id && e.small === unit.small && e.barding === unit.barding,
  );
  if (same < 0) return [...entries, unit];
  return entries.map((e, i) => (i === same ? { ...e, quantity: e.quantity + 1 } : e));
}

/** Hands one unit from a party member to a porter, within the porter's stowed capacity. */
export function stowWithPorter(
  w: World,
  data: GameData,
  memberId: string,
  index: number,
  porterId: string,
): TownResult {
  const p = porter(w, data, porterId);
  const m = w.members.find((x) => x.id === memberId && !x.dead);
  const entry = m?.character.inventory[index];
  if (!m || !entry) throw new Error(`no item ${index} on ${memberId}`);
  const carried = addOne(p.inventory, entry);
  if (load(data, carried) > data.content.npcRules.porterCapacity)
    return no(`${p.name} can't carry any more.`);
  p.inventory = carried;
  m.character = { ...m.character, inventory: takeOne(m.character.inventory, index) };
  return { ok: true };
}

/** Takes one unit back from a porter, if the member can carry it. */
export function takeFromPorter(
  w: World,
  data: GameData,
  porterId: string,
  index: number,
  memberId: string,
): TownResult {
  const p = porter(w, data, porterId);
  const m = w.members.find((x) => x.id === memberId && !x.dead);
  const entry = p.inventory[index];
  if (!m || !entry) throw new Error(`no item ${index} on ${porterId}`);
  const inventory = addOne(m.character.inventory, entry);
  const problem = inventoryProblem(data, m, inventory);
  if (problem) return no(problem);
  m.character = { ...m.character, inventory };
  p.inventory = takeOne(p.inventory, index);
  return { ok: true };
}
