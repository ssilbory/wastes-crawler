// Hiring and dismissing NPCs, and a porter's load (docs/rules-adaptation.md, NPCs in Phase 6c;
// vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.3.0 Hirelings and Services.md).
import type { GameData } from '../character/context.ts';
import {
  entryEncumbrance,
  findItem,
  type CatalogItem,
  type InventoryEntry,
} from '../character/items.ts';
import { emit } from './bus.ts';
import { note } from './members.ts';
import { addNpc, hirelingType, MAX_NPCS, npcRoom, removeNpc } from './npcs.ts';
import { hireBlocked } from './shares.ts';
import type { TownResult } from './services.ts';
import { inventoryProblem } from './shop.ts';
import { toTenths } from '../../rules/economy.ts';
import { settleShare } from './shares.ts';
import { currentTown, priceHere, spend, townHere } from './town.ts';
import { shareText } from './wording.ts';
import type { Npc, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Hires in town for the signing fee; the hireling's pay is a share of the loot (shares.ts). */
export function hire(w: World, data: GameData, typeId: string): TownResult {
  townHere(w, data);
  if (w.encounter) return no('Settle the encounter first.');
  const blocked = hireBlocked(w, data);
  if (blocked) return no(blocked);
  const t = hirelingType(data, typeId);
  if (npcRoom(w, t.role === 'fighter') === null)
    return no(`The party has room for ${MAX_NPCS} NPCs.`);
  const fee = data.content.npcRules.signingFee;
  if (!spend(w, data, fee)) return no(`Signing on costs ${priceHere(w, data, fee)} crowns.`);
  const npc = addNpc(w, data, 'hireling', t.id, t.monster, null, t.role === 'fighter') as Npc;
  npc.refund = data.content.npcRules.signingRefund;
  note(w, `${npc.name} signs on as a ${t.name} for ${shareText(t.share)} of the loot.`);
  return { ok: true };
}

/**
 * Sends an NPC away anywhere; a captive left behind is abandoned. A hireling is paid what they are
 * owed first, and let go in a settlement returns part of their signing fee (Sam's call).
 */
export function dismiss(w: World, data: GameData, id: string): TownResult {
  const n = w.npcs.find((x) => x.id === id);
  if (!n) throw new Error(`no NPC ${id}`);
  if (n.inventory.length > 0) return no(`Take ${n.name}'s load first.`);
  if (n.kind === 'hireling') settleShare(w, n);
  removeNpc(w, id);
  const inTown = !w.dungeon && currentTown(w, data) !== undefined;
  if (n.kind === 'hireling' && inTown && n.refund > 0) {
    w.purse = toTenths(w.purse + n.refund);
    note(w, `${n.name} is let go and hands back ${n.refund} crowns of the signing fee.`);
  } else
    note(
      w,
      n.kind === 'hireling'
        ? `${n.name} is let go.`
        : n.kind === 'undead'
          ? `${n.name} is released and falls still.`
          : n.kind === 'beast'
            ? `${n.name} is set loose and lopes off into the wastes.`
            : n.kind === 'summon'
              ? `${n.name} is dismissed and fades.`
              : `The party leaves ${n.name} behind.`,
    );
  if (n.kind === 'escort') emit(w, data, { kind: 'npc-died', npc: n });
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
