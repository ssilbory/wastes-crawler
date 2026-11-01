// Hiring and dismissing NPCs (docs/rules-adaptation.md, NPCs in Phase 6c;
// vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.3.0 Hirelings and Services.md).
import type { GameData } from '../character/context.ts';
import { emit } from './bus.ts';
import { note } from './members.ts';
import { addNpc, hirelingType, MAX_NPCS, npcRoom, removeNpc } from './npcs.ts';
import { hireBlocked } from './shares.ts';
import type { TownResult } from './services.ts';
import { toTenths } from '../../rules/economy.ts';
import { settleShare } from './shares.ts';
import { shareText } from './wording.ts';
import type { Npc, World } from './types.ts';
import { sendAway } from './companions.ts';
import { currentTown, priceHere, spend, townHere } from './town-prices.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Hires in town for the signing fee; the hireling's pay is a share of the loot (shares.ts). */
export function hire(w: World, data: GameData, typeId: string): TownResult {
  townHere(w, data);
  if (w.encounter) return no('Settle the encounter first.');
  const blocked = hireBlocked(w, data);
  if (blocked) return no(blocked);
  const t = hirelingType(data, typeId);
  if (npcRoom(w, t.role === 'fighter') === null)
    return no(`The party has room for ${MAX_NPCS} NPCs.`);
  const fee = data.content.npcRules.signingFee;
  if (!spend(w, data, fee)) return no(`Signing on costs ${priceHere(w, data, fee)} crowns.`);
  const npc = addNpc(w, data, 'hireling', t.id, t.monster, null, t.role === 'fighter') as Npc;
  npc.refund = data.content.npcRules.signingRefund;
  note(w, `${npc.name} signs on as a ${t.name} for ${shareText(t.share)} of the loot.`);
  return { ok: true };
}

/**
 * Sends an NPC away anywhere; a captive left behind is abandoned. A hireling is paid what they are
 * owed first, and let go in a settlement returns part of their signing fee (Sam's call).
 */
export function dismiss(w: World, data: GameData, id: string): TownResult {
  const n = w.npcs.find((x) => x.id === id);
  if (!n) throw new Error(`no NPC ${id}`);
  if (n.inventory.length > 0) return no(`Take ${n.name}'s load first.`);
  // A companion is sent away to wait, not let go (companions.ts).
  if (n.kind === 'companion' && n.master) return sendAway(w, n.master);
  if (n.kind === 'hireling') settleShare(w, n);
  removeNpc(w, id);
  const inTown = !w.dungeon && currentTown(w, data) !== undefined;
  if (n.kind === 'hireling' && inTown && n.refund > 0) {
    w.purse = toTenths(w.purse + n.refund);
    note(w, `${n.name} is let go and hands back ${n.refund} crowns of the signing fee.`);
  } else
    note(
      w,
      n.kind === 'hireling'
        ? `${n.name} is let go.`
        : n.kind === 'undead'
          ? `${n.name} is released and falls still.`
          : n.kind === 'beast'
            ? `${n.name} is set loose and lopes off into the wastes.`
            : n.kind === 'pack'
              ? `${n.name} is set loose and wanders off into the wastes.`
              : n.kind === 'summon'
                ? `${n.name} is dismissed and fades.`
                : n.kind === 'tree'
                  ? `${n.name} is let go and roots where it stands.`
                  : n.kind === 'thrall'
                    ? `${n.name} is released from the spell and slips away.`
                    : `The party leaves ${n.name} behind.`,
    );
  if (n.kind === 'escort') emit(w, data, { kind: 'npc-died', npc: n });
  return { ok: true };
}
