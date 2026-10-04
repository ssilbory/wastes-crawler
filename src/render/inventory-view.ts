// A member's gear and load for the inventory panel (Phase 17): each line's encumbrance, the
// Readied and Stowed totals against their limits, and who could take it. Pure.
import type { ItemLocation } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import { characterSheet } from '../game/character/derived.ts';
import { entryEncumbrance, findItem } from '../game/character/items.ts';
import type { World } from '../game/world/types.ts';
import type { Load } from '../rules/encumbrance.ts';

export interface GearLine {
  index: number;
  name: string;
  quantity: number;
  location: ItemLocation;
  /** Encumbrance of the whole line. */
  encumbrance: number;
}

export interface InventoryView {
  name: string;
  load: Load;
  lines: GearLine[];
  /** Living members who could be handed something. */
  others: { id: string; name: string }[];
  /** Why nothing can change now, if so. */
  blocked: string | null;
  /** Underground, each change takes an exploration turn. */
  costsTurn: boolean;
}

export function inventoryView(w: World, data: GameData, memberId: string): InventoryView | null {
  const m = w.members.find((x) => x.id === memberId);
  if (!m) return null;
  const c = m.character;
  return {
    name: c.name,
    load: characterSheet(c, data).equipment.load,
    lines: c.inventory.map((e, index) => {
      const item = findItem(data, e.id);
      return {
        index,
        name: item?.name ?? e.id,
        quantity: e.quantity,
        location: e.location,
        encumbrance: item ? entryEncumbrance(data, item, e) : 0,
      };
    }),
    others: w.members
      .filter((x) => x !== m && !x.dead)
      .map((x) => ({ id: x.id, name: x.character.name })),
    blocked: w.encounter ? 'Settle the encounter first.' : null,
    costsTurn: w.dungeon !== null,
  };
}

/** The load in a line: "Readied 3/5, Stowed 8/10", and Overloaded or too heavy past them. */
export function loadText(load: Load): string {
  const base = `Readied ${load.readied}/${load.readiedLimit}, Stowed ${load.stowed}/${load.stowedLimit}`;
  if (load.state === 'ok') return base;
  return `${base}. ${load.state === 'overloaded' ? 'Overloaded' : 'Too heavy to move'} by ${load.excess}`;
}
