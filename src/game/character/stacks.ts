// Inventory lines: joining like with like, and splitting part of a stack off (Phase 17).
import type { InventoryEntry } from './items.ts';

/** Two lines of the same thing, alike in everything but how many and where they are. */
function sameKind(a: InventoryEntry, b: InventoryEntry): boolean {
  const strip = (e: InventoryEntry) => JSON.stringify({ ...e, quantity: 0, location: 'stowed' });
  return strip(a) === strip(b);
}

/** Puts a line into an inventory, joining a matching line in the same place. */
export function putLine(inventory: InventoryEntry[], entry: InventoryEntry): InventoryEntry[] {
  const same = inventory.findIndex((e) => e.location === entry.location && sameKind(e, entry));
  if (same < 0) return [...inventory, entry];
  return inventory.map((e, i) =>
    i === same ? { ...e, quantity: e.quantity + entry.quantity } : e,
  );
}

/** Takes `quantity` of a line, splitting the stack when it's only part of it. */
export function takeLine(
  inventory: InventoryEntry[],
  index: number,
  quantity: number,
): { taken: InventoryEntry; rest: InventoryEntry[] } {
  const entry = inventory[index] as InventoryEntry;
  const rest =
    quantity < entry.quantity
      ? inventory.map((e, i) => (i === index ? { ...e, quantity: e.quantity - quantity } : e))
      : inventory.filter((_, i) => i !== index);
  return { taken: { ...entry, quantity }, rest };
}
