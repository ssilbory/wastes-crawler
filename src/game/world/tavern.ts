// The tavern (docs/rules-adaptation.md, Towns in Phase 6a): PCs leave the party here and rejoin at
// any tavern; roster characters new to the world join with the lowest XP in the world.
import type { Character, DefaultPreset } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import { newMember, note } from './members.ts';
import { MAX_PCS } from './new-world.ts';
import type { TownResult } from './services.ts';
import { townHere } from './town.ts';
import type { GameData } from '../character/context.ts';
import type { Member, World } from './types.ts';

const ROWS = 2;
const COLUMNS = 4;
const no = (reason: string): TownResult => ({ ok: false, reason });

/** The first free formation slot, front row first. */
export function freeSlot(w: World): { row: number; column: number } | null {
  for (let row = 0; row < ROWS; row++)
    for (let column = 0; column < COLUMNS; column++)
      if (!w.members.some((m) => m.row === row && m.column === column)) return { row, column };
  return null;
}

function room(w: World, data: GameData): TownResult | { row: number; column: number } {
  if (w.encounter) return no('Settle the encounter first.');
  townHere(w, data);
  const slot = freeSlot(w);
  if (w.members.length >= MAX_PCS || !slot) return no(`A party holds ${MAX_PCS} PCs.`);
  return slot;
}

export function bench(w: World, data: GameData, id: string): TownResult {
  townHere(w, data);
  const m = w.members.find((x) => x.id === id);
  if (!m) throw new Error(`no party member ${id}`);
  if (!w.members.some((x) => x !== m && !x.dead))
    return no('Someone living must stay in the party.');
  w.members = w.members.filter((x) => x !== m);
  w.benched.push(m);
  note(w, `${m.character.name} stays behind at the tavern.`);
  return { ok: true };
}

export function rejoin(w: World, data: GameData, id: string): TownResult {
  const slot = room(w, data);
  if ('ok' in slot) return slot;
  const m = w.benched.find((x) => x.id === id);
  if (!m) throw new Error(`no benched member ${id}`);
  w.benched = w.benched.filter((x) => x !== m);
  w.members.push({ ...m, ...slot });
  note(w, `${m.character.name} rejoins the party.`);
  return { ok: true };
}

const everyone = (w: World): Member[] => [...w.members, ...w.benched];

/** True if this roster character is already somewhere in the world. */
export const inWorld = (w: World, characterId: string) =>
  everyone(w).some((m) => m.character.id === characterId);

/** The XP a newcomer starts with: the lowest of any PC in the world. */
export function catchUpXp(w: World): number {
  return Math.min(...everyone(w).map((m) => m.character.xp));
}

/** A roster character joins; their crowns go to the purse and their XP catches up. */
export function recruit(
  w: World,
  data: GameData,
  character: Character,
  defaultAction: DefaultPreset,
): TownResult {
  const slot = room(w, data);
  if ('ok' in slot) return slot;
  if (inWorld(w, character.id)) return no(`${character.name} is already in this world.`);
  const xp = Math.max(character.xp, catchUpXp(w));
  const ids = new Set(everyone(w).map((m) => m.id));
  let n = everyone(w).length;
  while (ids.has(`m-${n}`)) n++;
  w.purse = toTenths(w.purse + character.crowns);
  w.members.push(newMember(`m-${n}`, { character: { ...character, xp }, ...slot, defaultAction }));
  note(w, `${character.name} joins the party.`);
  return { ok: true };
}
