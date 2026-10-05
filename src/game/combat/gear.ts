// Ready or Stow an Item as a Main Action (vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md;
// 2.9.0 Encumbrance.md): one unit of a PC's line moves between readied and stowed, and their
// attacks follow what is in hand (Phase 17).
import type { Character } from '../../data/schemas/index.ts';
import { characterSheet } from '../character/derived.ts';
import { lineLabel } from '../character/items.ts';
import { putLine, takeLine } from '../character/stacks.ts';
import { pcCombatant } from './combatants.ts';
import { say } from './log.ts';
import type { Battle, Combatant } from './types.ts';

/** The PC's character after the move, or null when it can't be made or leaves them too heavy. */
export function afterMove(
  b: Battle,
  actor: Combatant,
  index: number,
  location: 'readied' | 'stowed',
): Character | null {
  const c = actor.character;
  const entry = c?.inventory[index];
  if (!c || !entry || entry.location === 'worn' || entry.location === location) return null;
  const { taken, rest } = takeLine(c.inventory, index, 1);
  const next = { ...c, inventory: putLine(rest, { ...taken, location }) };
  return characterSheet(next, b.data).equipment.load.state === 'too-heavy' ? null : next;
}

/** Readies or stows one unit of an inventory line; false if it can't be done. */
export function readyOrStow(
  b: Battle,
  actor: Combatant,
  index: number,
  location: 'readied' | 'stowed',
): boolean {
  const next = afterMove(b, actor, index, location);
  const entry = actor.character?.inventory[index];
  if (!next || !entry) return false;
  actor.character = next;
  actor.attacks = pcCombatant(b.data, next, actor.id).attacks;
  say(
    b,
    `${actor.name} ${location === 'readied' ? 'readies' : 'stows'} ${lineLabel(b.data, entry)}.`,
  );
  return true;
}
