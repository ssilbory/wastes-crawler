// Antidotes (vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury, Healing, And System
// Strain.md, 2.5.5: specialized antitoxins neutralize a poison entirely; Sam's call sells them as
// the game's antidote) and the Poisoner focus at level 2 (vendor/wwn-srd/1.0 Character Creation/
// 1.6.0 Foci.md: a universal antidote for any poisoned ally as a Main Action, needing no dose).
// Out of combat only.
import type { InventoryEntry } from '../character/items.ts';
import type { GameData } from '../character/context.ts';
import { POISONER } from './ailing.ts';
import { cure } from './ailments.ts';
import { alive, awake, note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

const isPoisoner = (m: Member) => m.character.foci.some((f) => f.id === POISONER && f.level >= 2);

const doseIndex = (data: GameData, m: Member) =>
  m.character.inventory.findIndex((e) => e.id === data.content.ailments.antidote.id);

/** Who can neutralize a poison now: a conscious Poisoner, or anyone conscious with an antidote. */
export const antidoteGivers = (w: World, data: GameData): Member[] =>
  alive(w).filter((m) => awake(m) && (isPoisoner(m) || doseIndex(data, m) >= 0));

function takeOne(entries: InventoryEntry[], index: number): InventoryEntry[] {
  const e = entries[index] as InventoryEntry;
  return e.quantity > 1
    ? entries.map((x, i) => (i === index ? { ...x, quantity: x.quantity - 1 } : x))
    : entries.filter((_, i) => i !== index);
}

/** Neutralizes a Poisoned member's poison: a Poisoner's own remedy, or one antidote from the giver. */
export function giveAntidote(
  w: World,
  data: GameData,
  giverId: string,
  targetId: string,
): TownResult {
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  const giver = antidoteGivers(w, data).find((m) => m.id === giverId);
  if (!giver) return { ok: false, reason: 'No one able has an antidote.' };
  const target = alive(w).find((m) => m.id === targetId && m.poisoned);
  if (!target) return { ok: false, reason: 'Choose someone who is Poisoned.' };
  const poisoner = isPoisoner(giver);
  if (!poisoner)
    giver.character = {
      ...giver.character,
      inventory: takeOne(giver.character.inventory, doseIndex(data, giver)),
    };
  cure(target, 'poison');
  const how = poisoner ? 'a remedy of their own' : 'an antidote';
  note(w, `${giver.character.name} gives ${target.character.name} ${how}; the poison is gone.`);
  return { ok: true };
}
