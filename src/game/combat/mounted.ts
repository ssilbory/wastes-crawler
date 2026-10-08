// War mounts fight from their riders' slots (docs/rules-adaptation.md, Mounts): a mount takes no
// formation slot of its own and moves wherever its rider goes.
import type { Combatant } from './types.ts';

/** Holds a formation slot of its own: anyone but a ridden war mount. */
export const inSlot = (c: Combatant) => c.rider === null;

/** Puts each war mount back under its rider after the formation changes. */
export function followRiders(combatants: readonly Combatant[]): void {
  for (const c of combatants) {
    if (c.rider === null) continue;
    const rider = combatants.find((x) => x.id === c.rider);
    if (rider) [c.row, c.column] = [rider.row, rider.column];
  }
}
