// Hirelings and other NPCs in the party's two NPC slots (docs/rules-adaptation.md, Party and
// formation; NPCs in Phase 6c). Wages and the half share of treasure, and the Morale check after a
// dangerous fight: vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.3.0 Hirelings and Services.md.
// NPC hit points: 1d8 per hit die (5.0 Monsters and Foes/Monster and NPC Stats.md); NPCs heal their
// hit dice each night (2.0 The Rules of the Game/2.5.0, 2.5.3).
import type { Captive, HirelingType, Monster } from '../../data/schemas/index.ts';
import { moraleHolds } from '../../rules/combat.ts';
import { rollDie } from '../../rules/dice.ts';
import { toTenths } from '../../rules/economy.ts';
import type { LootDice } from '../../data/schemas/index.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { activeEffects } from '../character/equipment.ts';
import { alive, note } from './members.ts';
import type { Npc, World } from './types.ts';

export const MAX_NPCS = 2;
const COLUMNS = 4;

export function monsterOf(data: GameData, id: string): Monster {
  const m = findMonster(data, id);
  if (!m) throw new Error(`unknown monster ${id}`);
  return m;
}

export function hirelingType(data: GameData, id: string): HirelingType {
  const h = data.content.npcRules.hirelings.find((x) => x.id === id);
  if (!h) throw new Error(`unknown hireling ${id}`);
  return h;
}

export function captiveOf(data: GameData, id: string): Captive {
  const c = data.content.captives.find((x) => x.id === id);
  if (!c) throw new Error(`unknown captive ${id}`);
  return c;
}

/** An escort's stat line, from the first step of its quest. */
function escortMonster(data: GameData, questId: string): string {
  const step = data.content.quests.find((q) => q.id === questId)?.objectives[0];
  if (step?.kind !== 'escort') throw new Error(`no escort for quest ${questId}`);
  return step.monster;
}

/** The SRD stat line an NPC fights and heals with. */
export const npcMonster = (data: GameData, n: Npc) =>
  monsterOf(
    data,
    n.kind === 'hireling'
      ? hirelingType(data, n.type).monster
      : n.kind === 'captive'
        ? captiveOf(data, n.type).monster
        : escortMonster(data, n.type),
  );

/** The hireling type behind an NPC, or undefined for a captive. */
export const typeOf = (data: GameData, n: Npc) =>
  n.kind === 'hireling' ? hirelingType(data, n.type) : undefined;

export const fights = (data: GameData, n: Npc) => typeOf(data, n)?.role === 'fighter';
export const hirelings = (w: World) => w.npcs.filter((n) => n.kind === 'hireling');

/** A conscious Wilderness Guide in the party, if any. */
export const guideOf = (w: World, data: GameData, id: string | null) =>
  w.npcs.find((n) => n.id === id && n.hp > 0 && typeOf(data, n)?.role === 'guide');

export const firstGuide = (w: World, data: GameData) =>
  w.npcs.find((n) => n.hp > 0 && typeOf(data, n)?.role === 'guide');

/** A conscious Mundane Physician in the party, if any. */
export const firstPhysician = (w: World, data: GameData) =>
  w.npcs.find((n) => n.hp > 0 && typeOf(data, n)?.role === 'physician');

/** A free formation slot: fighters fill the front row first, everyone else the rear. */
export function freeSlot(w: World, front: boolean): { row: number; column: number } | null {
  const taken = (row: number, column: number) =>
    [...w.members, ...w.npcs].some((x) => x.row === row && x.column === column);
  for (const row of front ? [0, 1] : [1, 0])
    for (let column = 0; column < COLUMNS; column++)
      if (!taken(row, column)) return { row, column };
  return null;
}

/** Room for one more NPC: a free NPC slot and a free formation slot. */
export function npcRoom(w: World, front: boolean): { row: number; column: number } | null {
  return w.npcs.length < MAX_NPCS ? freeSlot(w, front) : null;
}

function nextId(w: World): string {
  let n = 0;
  while (w.npcs.some((x) => x.id === `npc-${n}`)) n++;
  return `npc-${n}`;
}

function nextName(w: World, data: GameData): string {
  const names = data.content.npcRules.names;
  return names.find((name) => !w.npcs.some((x) => x.name === name)) ?? (names[0] as string);
}

/** A new NPC with rolled hit points, placed in a free slot; null without room. */
export function addNpc(
  w: World,
  data: GameData,
  kind: Npc['kind'],
  type: string,
  monster: string,
  name: string | null,
  front: boolean,
): Npc | null {
  const slot = npcRoom(w, front);
  if (!slot) return null;
  const m = monsterOf(data, monster);
  let hp = 0;
  for (let i = 0; i < m.hitDice; i++) hp += rollDie(w.rng, 8);
  const npc: Npc = {
    id: nextId(w),
    kind,
    type,
    name: name ?? nextName(w, data),
    hp,
    maxHp: hp,
    ...slot,
    quitting: false,
    inventory: [],
    owed: 0,
    refund: 0,
  };
  w.npcs.push(npc);
  return npc;
}

export function removeNpc(w: World, id: string): Npc {
  const n = w.npcs.find((x) => x.id === id);
  if (!n) throw new Error(`no NPC ${id}`);
  w.npcs = w.npcs.filter((x) => x !== n);
  return n;
}

/** Fed and sheltered NPCs heal their hit dice overnight. Hirelings draw no wage (shares.ts). */
export function nightForNpcs(w: World, data: GameData, rested: boolean): void {
  if (!rested) return;
  for (const n of w.npcs) n.hp = Math.min(n.maxHp, n.hp + npcMonster(data, n).hitDice);
}

/** SRD 3.3.0: after a particularly dangerous fight, each hireling checks Morale or quits. */
export function moraleAfterFight(w: World, data: GameData): void {
  // Herd-Loyal beastmen steady the hirelings (docs/rules-adaptation.md, Regions and setting).
  const steady = Math.max(
    0,
    ...alive(w).flatMap((m) =>
      activeEffects(data, m.character.foci).flatMap((e) =>
        e.kind === 'hireling-morale' ? [e.amount] : [],
      ),
    ),
  );
  for (const n of hirelings(w)) {
    if (n.quitting) continue;
    const { morale } = npcMonster(data, n);
    if (moraleHolds(w.rng, Math.min(12, morale + steady))) continue;
    n.quitting = true;
    note(w, `${n.name} has had enough and will leave at the next town.`);
  }
}

/**
 * Sam's call: each hireling with the party takes its share of loot dice as they are won, valued at
 * the dice's average: `share` of one PC's share among the living PCs and the hirelings' shares.
 */
export function accrueShares(w: World, data: GameData, dice: readonly LootDice[]): void {
  const hired = hirelings(w);
  if (hired.length === 0) return;
  const value = dice.reduce((sum, d) => sum + (d.count * (d.sides + 1)) / 2, 0);
  const shares = hired.map((n) => hirelingType(data, n.type).share);
  const pcs = w.members.filter((m) => !m.dead).length;
  const total = pcs + shares.reduce((a, b) => a + b, 0);
  hired.forEach((n, i) => {
    n.owed = toTenths(n.owed + (value * (shares[i] as number)) / total);
  });
}
