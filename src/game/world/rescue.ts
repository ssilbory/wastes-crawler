// Rescues and arrivals (docs/rules-adaptation.md, NPCs in Phase 6c): a freed captive takes an NPC
// slot until the party brings them to their town, for crowns and XP; hirelings who failed Morale
// leave at the next town (vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.3.0).
import type { GameData } from '../character/context.ts';
import { toTenths } from '../../rules/economy.ts';
import { emit } from './bus.ts';
import { note } from './members.ts';
import { addNpc, captiveOf, removeNpc } from './npcs.ts';
import type { World } from './types.ts';

/** Frees a captive into an NPC slot; with no room, they go their own way. */
export function freeCaptive(w: World, data: GameData, captiveId: string): boolean {
  const c = captiveOf(data, captiveId);
  const name = c.name.charAt(0).toUpperCase() + c.name.slice(1);
  emit(w, data, { kind: 'captive-freed', captive: c.id });
  if (!addNpc(w, data, 'captive', c.id, c.monster, name, false)) {
    note(w, `${name} is free, but with no room in the party goes their own way.`);
    return false;
  }
  note(w, `${name} is free and joins the party until they reach safety.`);
  return true;
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
    if (c.destination !== townId) continue;
    removeNpc(w, n.id);
    w.purse = toTenths(w.purse + c.reward);
    for (const m of w.members) {
      if (m.dead) m.pendingXp += c.xp;
      else m.character = { ...m.character, xp: m.character.xp + c.xp };
    }
    note(w, `${n.name} is home safe: a reward of ${c.reward} crowns, and ${c.xp} XP each.`);
  }
}
