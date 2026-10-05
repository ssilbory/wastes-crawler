// Managing a member's gear in play (Sam's calls, Phase 17; docs/rules-adaptation.md, Inventory):
// moving items between worn, readied, and stowed (vendor/wwn-srd/2.0 The Rules of the Game/2.9.0
// Encumbrance.md), handing them to another member, and dropping them, a whole line or part of a
// stack. Anywhere out of combat; underground each change takes an exploration turn.
import type { ItemLocation } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { findItem, type InventoryEntry } from '../character/items.ts';
import { putLine, takeLine } from '../character/stacks.ts';
import { passTurn } from '../dungeon/time.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { inventoryProblem } from './shop.ts';
import type { Member, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Why gear can't change hands now, or the member and line to change. */
function check(
  w: World,
  memberId: string,
  index: number,
  quantity: number,
): { m: Member; entry: InventoryEntry } | string {
  if (w.encounter) return 'Settle the encounter first.';
  const m = w.members.find((x) => x.id === memberId);
  const entry = m?.character.inventory[index];
  if (!m || !entry) return 'There is no such item.';
  if (!Number.isInteger(quantity) || quantity < 1 || quantity > entry.quantity)
    return `Choose from 1 to ${entry.quantity}.`;
  return { m, entry };
}

/** Underground, sorting gear takes an exploration turn. */
function done(w: World, data: GameData): TownResult {
  if (w.dungeon) passTurn(w, data);
  return { ok: true };
}

/** Moves some or all of a line to worn, readied, or stowed. */
export function moveGear(
  w: World,
  data: GameData,
  memberId: string,
  index: number,
  location: ItemLocation,
  quantity: number,
): TownResult {
  const found = check(w, memberId, index, quantity);
  if (typeof found === 'string') return no(found);
  const { m, entry } = found;
  if (entry.location === location) return no('It is already there.');
  const { taken, rest } = takeLine(m.character.inventory, index, quantity);
  const inventory = putLine(rest, { ...taken, location });
  const problem = inventoryProblem(data, m, inventory, m.character.inventory);
  if (problem) return no(problem);
  m.character = { ...m.character, inventory };
  return done(w, data);
}

/** Hands some or all of a line to another living member, who stows it. */
export function giveGear(
  w: World,
  data: GameData,
  fromId: string,
  index: number,
  toId: string,
  quantity: number,
): TownResult {
  const found = check(w, fromId, index, quantity);
  if (typeof found === 'string') return no(found);
  const { m: from } = found;
  const to = w.members.find((x) => x.id === toId);
  if (!to || to.dead || to === from) return no('Choose someone else in the party.');
  const { taken, rest } = takeLine(from.character.inventory, index, quantity);
  const received = putLine(to.character.inventory, { ...taken, location: 'stowed' });
  const problem = inventoryProblem(data, to, received);
  if (problem) return no(problem);
  from.character = { ...from.character, inventory: rest };
  to.character = { ...to.character, inventory: received };
  return done(w, data);
}

/** Leaves some or all of a line behind for good. */
export function dropGear(
  w: World,
  data: GameData,
  memberId: string,
  index: number,
  quantity: number,
): TownResult {
  const found = check(w, memberId, index, quantity);
  if (typeof found === 'string') return no(found);
  const { m } = found;
  const { taken, rest } = takeLine(m.character.inventory, index, quantity);
  m.character = { ...m.character, inventory: rest };
  const name = findItem(data, taken.id)?.name ?? taken.id;
  note(
    w,
    `${m.character.name} leaves behind ${name}${taken.quantity > 1 ? ` × ${taken.quantity}` : ''}.`,
  );
  return done(w, data);
}
