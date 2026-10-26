// The tavern (docs/rules-adaptation.md, Towns in Phase 6a): PCs leave the party here and rejoin at
// any tavern; roster characters new to the world join with the lowest XP in the world.
import type { Character, DefaultPreset } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import { newMember, note } from './members.ts';
import { MAX_PCS } from './new-world.ts';
import { freeSlot } from './npcs.ts';
import type { TownResult } from './services.ts';
import type { GameData } from '../character/context.ts';
import type { Member, World } from './types.ts';
import { followMaster } from './companion-sync.ts';
import { townHere } from './town-prices.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

function room(w: World, data: GameData): TownResult | { row: number; column: number } {
  if (w.encounter) return no('Settle the encounter first.');
  townHere(w, data);
  const slot = freeSlot(w, true);
  if (w.members.length >= MAX_PCS || !slot) return no(`A party holds ${MAX_PCS} PCs.`);
  return slot;
}

export function bench(w: World, data: GameData, id: string): TownResult {
  townHere(w, data);
  const m = w.members.find((x) => x.id === id);
  if (!m) throw new Error(`no party member ${id}`);
  if (!w.members.some((x) => x !== m && !x.dead))
    return no('Someone living must stay in the party.');
  followMaster(w, m);
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
  const work = w.projects.find((p) => p.crafter === id && p.staying);
  if (work)
    return no(`${m.character.name} is still at work in the workshop (${work.daysLeft} days left).`);
  w.benched = w.benched.filter((x) => x !== m);
  w.members.push({ ...m, ...slot });
  note(w, `${m.character.name} rejoins the party.`);
  return { ok: true };
}

const everyone = (w: World): Member[] => [...w.members, ...w.benched];

/** True if this roster character is already somewhere in the world, or was lost in it. */
export const inWorld = (w: World, characterId: string) =>
  everyone(w).some((m) => m.character.id === characterId) ||
  w.lost.some((l) => l.id === characterId);

/**
 * The XP a newcomer starts with: the lowest of any PC in the world, or none when a fallen party
 * left no one, so a new party starts as it was made.
 */
export function catchUpXp(w: World): number {
  const pcs = everyone(w);
  return pcs.length === 0 ? 0 : Math.min(...pcs.map((m) => m.character.xp));
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
  if (w.lost.some((l) => l.id === character.id))
    return no(`${character.name} was lost when the party fell, and can't come back.`);
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
