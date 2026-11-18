// Rescues and arrivals (docs/rules-adaptation.md, NPCs in Phase 6c): a freed captive takes an NPC
// slot until the party brings them to their town, for crowns and XP; hirelings who failed Morale
// leave at the next town (vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.3.0 Hirelings and
// Services.md). A captive freed with the NPC slots full waits while the party makes room.
import type { GameData } from '../character/context.ts';
import { toTenths } from '../../rules/economy.ts';
import { emit } from './bus.ts';
import { note } from './members.ts';
import { addNpc, captiveOf, removeNpc } from './npcs.ts';
import type { TownResult } from './services.ts';
import type { World } from './types.ts';

const capital = (name: string) => name.charAt(0).toUpperCase() + name.slice(1);

/** Puts a freed captive in an NPC slot, if there is one. */
function join(w: World, data: GameData, captiveId: string): boolean {
  const c = captiveOf(data, captiveId);
  const name = capital(c.name);
  if (!addNpc(w, data, 'captive', c.id, c.monster, name, false)) return false;
  // The party learns where they are bound, and the map shows it (render/quest-view.ts).
  const home = data.content.regions.flatMap((r) => r.sites).find((t) => t.id === c.destination);
  note(w, `${name} is free and joins the party until they reach ${home?.name ?? 'safety'}.`);
  return true;
}

/**
 * Frees a captive into an NPC slot. With no room they wait on the party, which dismisses an NPC
 * for them or sends them on their own way (Sam's call); one already waiting goes their own way.
 */
export function freeCaptive(w: World, data: GameData, captiveId: string): boolean {
  const c = captiveOf(data, captiveId);
  emit(w, data, { kind: 'captive-freed', captive: c.id });
  if (join(w, data, c.id)) return true;
  if (w.freedCaptive) partWithFreed(w, data);
  w.freedCaptive = c.id;
  note(w, `${capital(c.name)} is free, but the party has no room for them.`);
  return false;
}

/** The freed captive waiting on room in the party, if any. */
export const freedWaiting = (w: World, data: GameData) =>
  w.freedCaptive ? captiveOf(data, w.freedCaptive) : undefined;

/** The waiting captive joins, once there is room. */
export function takeFreed(w: World, data: GameData): TownResult {
  const c = freedWaiting(w, data);
  if (!c) throw new Error('no freed captive waits');
  if (!join(w, data, c.id)) return { ok: false, reason: 'There is no room in the party.' };
  w.freedCaptive = null;
  return { ok: true };
}

/** The party keeps its company, and the waiting captive goes their own way. */
export function partWithFreed(w: World, data: GameData): void {
  const c = freedWaiting(w, data);
  if (!c) throw new Error('no freed captive waits');
  w.freedCaptive = null;
  note(w, `${capital(c.name)} thanks the party and goes their own way.`);
}

/** Arriving in a town: quitters leave, and captives bound here are delivered. */
export function arriveNpcs(w: World, data: GameData, townId: string): void {
  for (const n of [...w.npcs]) {
    if (n.kind === 'hireling' && n.quitting) {
      removeNpc(w, n.id);
      note(
        w,
        `${n.name} collects their pay and leaves${n.inventory.length > 0 ? ', dropping the load' : ''}.`,
      );
      continue;
    }
    if (n.kind !== 'captive') continue;
    const c = captiveOf(data, n.type);
    // One who waits settles instead, to run an institution (institutions.ts).
    if (c.destination !== townId || c.waits) continue;
    removeNpc(w, n.id);
    w.purse = toTenths(w.purse + c.reward);
    for (const m of w.members) {
      if (m.dead) m.pendingXp += c.xp;
      else m.character = { ...m.character, xp: m.character.xp + c.xp };
    }
    note(w, `${n.name} is home safe: a reward of ${c.reward} crowns, and ${c.xp} XP each.`);
    emit(w, data, { kind: 'captive-home', captive: c.id });
  }
}
