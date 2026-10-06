// Rearranging the party outside combat (docs/rules-adaptation.md, Formation rules: Rearranging).
import { FORMATION_ROWS, ROW_SLOTS } from '../../rules/formation.ts';
import type { World } from './types.ts';

/** Moves a PC or NPC to a slot, swapping with whoever stands there; false for a bad id or slot. */
export function moveToSlot(w: World, id: string, row: number, column: number): boolean {
  if (!Number.isInteger(row) || !Number.isInteger(column)) return false;
  if (row < 0 || row >= FORMATION_ROWS || column < 0 || column >= ROW_SLOTS) return false;
  const everyone = [...w.members, ...w.npcs];
  const mover = everyone.find((x) => x.id === id);
  if (!mover) return false;
  const occupant = everyone.find((x) => x !== mover && x.row === row && x.column === column);
  if (occupant) Object.assign(occupant, { row: mover.row, column: mover.column });
  Object.assign(mover, { row, column });
  return true;
}
