// Taking a side in a siege between two rivals (Phase 23d; docs/rules-adaptation.md, Sieges:
// Rivals' sieges; Sam's call: the party picks a side). In a town one rival holds and another
// besieges, the party may fight with the besiegers (its share of each assault is the holder's
// sturdiest asset, and the lines let it through), with the holder (as in a siege on the ally:
// the lines bar its way, and it fights the sturdiest besieger), or keep out of it altogether.
// The pick is made once a siege, from inside the town; until then the party keeps out.
import type { Siege } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { factionOf, locationName } from '../factions/state.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { partyIn, partySide } from './siege-state.ts';
import type { World } from './types.ts';

export type Side = 'attacker' | 'defender' | 'out';

/** The rivals' sieges of the town the party stands in that it has not picked a side in. */
export const undecided = (w: World, data: GameData): Siege[] =>
  w.sieges.filter((s) => partySide(data, s) === null && partyIn(w, data, s.town));

/** The party takes a side in a rivals' siege of the town it stands in, or keeps out of it. */
export function chooseSide(w: World, data: GameData, attacker: string, side: Side): TownResult {
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  const s = undecided(w, data).find((x) => x.attacker === attacker);
  if (!s) return { ok: false, reason: 'There is no side to take here.' };
  s.side = side;
  const town = locationName(data, s.town);
  if (side === 'out') {
    note(w, `The party keeps out of the siege of ${town}.`);
    return { ok: true };
  }
  // Taking a side joins the siege: its next assault comes tonight.
  s.joined = true;
  s.next = Math.min(s.next, w.day);
  const with_ = factionOf(data, side === 'attacker' ? s.attacker : s.defender).name;
  note(w, `The party takes ${with_}'s side in the siege of ${town}. The assault comes tonight.`);
  return { ok: true };
}
