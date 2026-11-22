// Rearranging the party outside combat (docs/rules-adaptation.md, Formation rules: Rearranging
// and Closing ranks).
import { FORMATION_ROWS, ROW_SLOTS } from '../../rules/formation.ts';
import type { Listener } from './bus.ts';
import type { World } from './types.ts';

/**
 * Outside combat, each row closes its gaps on its own: everyone in it slides left, keeping their
 * order, so the empty slots end up at the right (Sam's call). In a fight the slots stay put.
 */
export function closeRanks(w: World): void {
  if (w.encounter) return;
  const everyone = [...w.members, ...w.npcs];
  for (let row = 0; row < FORMATION_ROWS; row++)
    everyone
      .filter((x) => x.row === row)
      .sort((a, b) => a.column - b.column)
      .forEach((x, column) => {
        x.column = column;
      });
}

/** Once a fight is over, the rows close up on whoever it took. */
export const formationListener: Listener = (w, _data, e) => {
  if (e.kind === 'fight-over') closeRanks(w);
};

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
  closeRanks(w);
  return true;
}
