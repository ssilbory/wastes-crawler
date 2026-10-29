// A member's gear and load for the inventory panel (Phase 17): each line's encumbrance, the
// Readied and Stowed totals against their limits, who could take it, and what salvaging it would
// give (salvage.ts). Pure.
import type { ItemLocation } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import {
  entryEncumbrance,
  findItem,
  lineLabel,
  type InventoryEntry,
} from '../game/character/items.ts';
import { memberLoad, partyLoad } from '../game/world/party-load.ts';
import { salvager, salvageYield } from '../game/world/salvage.ts';
import type { World } from '../game/world/types.ts';
import type { Load } from '../rules/encumbrance.ts';
import { lineStats } from './gear-view.ts';

export interface GearLine {
  index: number;
  name: string;
  quantity: number;
  location: ItemLocation;
  /** Encumbrance of the whole line. */
  encumbrance: number;
  /** A weapon's, armor's, or shield's fighting numbers; null for other gear. */
  stats: string | null;
  /** What one unit salvages into, "0.25 metal"; null if it can't be salvaged. */
  salvage: string | null;
}

export interface InventoryView {
  name: string;
  /** Their own gear and their share of the party stash. */
  load: Load;
  /** Their share of the party stash's weight (Party stash). */
  stash: number;
  lines: GearLine[];
  /** Living members who could be handed something. */
  others: { id: string; name: string }[];
  /** Why nothing can change now, if so. */
  blocked: string | null;
  /** Underground, each change takes an exploration turn. */
  costsTurn: boolean;
  /** Who would salvage here, or why no one can. */
  salvager: { name: string } | { why: string };
}

export function inventoryView(w: World, data: GameData, memberId: string): InventoryView | null {
  const m = w.members.find((x) => x.id === memberId);
  if (!m) return null;
  const c = m.character;
  const party = partyLoad(w, data);
  return {
    name: c.name,
    load: memberLoad(w, data, m, party),
    stash: party.shares[m.id] ?? 0,
    lines: c.inventory.map((e, index) => {
      const item = findItem(data, e.id);
      return {
        index,
        name: lineLabel(data, e),
        quantity: e.quantity,
        location: e.location,
        encumbrance: item ? entryEncumbrance(data, item, e) : 0,
        stats: lineStats(data, item, e.bonus ?? 0),
        salvage: salvageText(data, e),
      };
    }),
    others: w.members
      .filter((x) => x !== m && !x.dead)
      .map((x) => ({ id: x.id, name: x.character.name })),
    blocked: w.encounter ? 'Settle the encounter first.' : null,
    costsTurn: w.dungeon !== null,
    salvager: ((s) => (typeof s === 'string' ? { why: s } : { name: s.character.name }))(
      salvager(w, data),
    ),
  };
}

function salvageText(data: GameData, e: InventoryEntry): string | null {
  const y = salvageYield(data, e);
  return y && `${y.amount} ${y.type}`;
}

/** The load in a line: "Readied 3/5, Stowed 8/10", and Overloaded or too heavy past them. */
export function loadText(load: Load): string {
  const base = `Readied ${load.readied}/${load.readiedLimit}, Stowed ${load.stowed}/${load.stowedLimit}`;
  if (load.state === 'ok') return base;
  return `${base}. ${load.state === 'overloaded' ? 'Overloaded' : 'Too heavy to move'} by ${load.excess}`;
}
