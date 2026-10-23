// A Beastmaster riding their companion (docs/rules-adaptation.md, Mounts: Sam's call). The beasts
// in mountRules.companionMounts carry their master above ground as a mount would (vendor/wwn-srd/
// 2.0 The Rules of the Game/2.12.0 Wilderness Exploration and Expeditions.md, 2.12.3), out of the
// NPC slots: it fights from its master's slot with no calming check, counts as the master's one
// mount, and carries no load. Underground it steps down into a slot of its own, or waits at the
// entrance, and is ridden again on the surface.
import type { GameData } from '../character/context.ts';
import { findPeople } from '../character/people.ts';
import { companionHere } from './companions.ts';
import { note } from './members.ts';
import { placeNpc, removeNpc } from './npcs.ts';
import type { TownResult } from './services.ts';
import type { Member, Npc, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The member's companion carrying them now: ridden, with a living master in the party. */
export function riddenBy(w: World, m: Member): Npc | undefined {
  const n = m.companion;
  return n?.ridden && !m.dead && w.members.includes(m) ? n : undefined;
}

/** Why the member can't ride their companion now, or null. */
export function rideProblem(w: World, data: GameData, m: Member): string | null {
  const name = m.character.name;
  const n = companionHere(w, m.id);
  if (!n) return `${name}'s companion isn't with the party.`;
  if (w.encounter) return 'Deal with the encounter first.';
  if (w.dungeon) return `There is no riding ${n.name} underground.`;
  if (m.dead) return `${name} is dead.`;
  const size = findPeople(data, m.character.people)?.size;
  if (size === 'large') return `${name} is a centaur and rides no one.`;
  const kind = data.content.mountRules.companionMounts.find((c) => c.monster === n.type);
  if (!kind || size === undefined || !kind.riderSizes.includes(size))
    return `${n.name} can't carry ${name}.`;
  if (n.hp <= 0) return `${n.name} is in no state to carry anyone.`;
  return null;
}

/** The member climbs onto their companion, leaving its NPC slot and any mount they rode. */
export function rideCompanion(w: World, data: GameData, memberId: string): TownResult {
  const m = w.members.find((x) => x.id === memberId);
  if (!m) throw new Error(`no member ${memberId}`);
  const problem = rideProblem(w, data, m);
  if (problem) return no(problem);
  const n = removeNpc(w, (companionHere(w, m.id) as Npc).id);
  for (const mount of w.mounts) if (mount.rider === m.id) mount.rider = null;
  m.companion = { ...n, ridden: true };
  note(w, `${m.character.name} rides ${n.name}.`);
  return { ok: true };
}

/** The member gets down, and the companion takes an NPC slot again; it needs one free. */
export function stepDown(w: World, memberId: string): TownResult {
  const m = w.members.find((x) => x.id === memberId);
  if (!m) throw new Error(`no member ${memberId}`);
  const n = riddenBy(w, m);
  if (!n) return no(`${m.character.name} isn't riding a companion.`);
  if (w.encounter) return no('Deal with the encounter first.');
  const afoot = { ...n };
  delete afoot.ridden;
  if (!placeNpc(w, afoot, true)) return no(`There is no room in the party for ${n.name} afoot.`);
  m.companion = null;
  note(w, `${m.character.name} gets down from ${n.name}.`);
  return { ok: true };
}

/** A companion no longer ridden goes on waiting, as one sent away does. */
export function unseat(n: Npc): void {
  delete n.ridden;
  delete n.remount;
}

/** Going underground: each ridden companion steps into a slot, or waits at the entrance. */
export function dismountForDungeon(w: World): void {
  for (const m of w.members) {
    const n = riddenBy(w, m);
    if (!n) continue;
    const afoot: Npc = { ...n, remount: true };
    delete afoot.ridden;
    if (placeNpc(w, afoot, true)) {
      m.companion = null;
      note(w, `${m.character.name} gets down from ${n.name} to go underground.`);
      continue;
    }
    m.companion = afoot;
    note(w, `${n.name} waits at the entrance, with no room in the party below.`);
  }
}

/** Back on the surface: companions that stepped down to go underground carry their masters again. */
export function remountOnSurface(w: World): void {
  for (const m of w.members) {
    const here = companionHere(w, m.id);
    const n = here?.remount ? here : m.companion?.remount ? m.companion : undefined;
    if (!n) continue;
    delete n.remount;
    // A companion that can't carry its master now stays where it is.
    if (m.dead || n.hp <= 0) continue;
    if (n === here) removeNpc(w, n.id);
    m.companion = { ...n, ridden: true };
    note(w, `${m.character.name} rides ${n.name} again.`);
  }
}
