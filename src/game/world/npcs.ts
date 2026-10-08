// Hirelings and other NPCs in the party's two NPC slots (docs/rules-adaptation.md, Party and
// formation; NPCs in Phase 6c). Wages and the half share of treasure, and the Morale check after a
// dangerous fight: vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.3.0 Hirelings and Services.md.
// NPC hit points: 1d8 per hit die (5.0 Monsters and Foes/Monster and NPC Stats.md); NPCs heal their
// hit dice each night (2.0 The Rules of the Game/2.5.0, 2.5.3).
import type { Captive, HirelingType, Monster } from '../../data/schemas/index.ts';
import { moraleHolds } from '../../rules/combat.ts';
import { servantPlace } from '../../rules/formation.ts';
import { rollDie } from '../../rules/dice.ts';
import { toTenths } from '../../rules/economy.ts';
import type { LootDice } from '../../data/schemas/index.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { activeEffects } from '../character/equipment.ts';
import { alive, awake, note } from './members.ts';
import type { Member, Npc, World } from './types.ts';

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

/** A pack beast's monster, from its mount type (docs/rules-adaptation.md, Mounts). */
function packMonster(data: GameData, typeId: string): string {
  const t = data.content.mountRules.mounts.find((x) => x.id === typeId);
  if (!t) throw new Error(`unknown mount ${typeId}`);
  return t.monster;
}

/** The SRD stat line an NPC fights and heals with. */
export const npcMonster = (data: GameData, n: Npc) =>
  monsterOf(
    data,
    n.kind === 'pack'
      ? packMonster(data, n.type)
      : n.kind === 'hireling'
        ? hirelingType(data, n.type).monster
        : n.kind === 'captive'
          ? captiveOf(data, n.type).monster
          : n.kind === 'escort'
            ? escortMonster(data, n.type)
            : n.type,
  );

/** The hireling type behind an NPC, or undefined for a captive. */
export const typeOf = (data: GameData, n: Npc) =>
  n.kind === 'hireling' ? hirelingType(data, n.type) : undefined;

/**
 * Fighting hirelings, servants, beasts, and trees fight; captives, escorts, and pack beasts stay
 * out of it.
 */
export const fights = (data: GameData, n: Npc) =>
  n.kind === 'hireling'
    ? typeOf(data, n)?.role === 'fighter'
    : n.kind !== 'captive' && n.kind !== 'escort' && n.kind !== 'pack';
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

/** `base`, or `base 2`, `base 3`, … for the first one no NPC in the party has. */
export function freshName(w: World, base: string): string {
  const taken = new Set(w.npcs.map((n) => n.name));
  let name = base;
  for (let n = 2; taken.has(name); n++) name = `${base} ${n}`;
  return name;
}

function nextName(w: World, data: GameData): string {
  const names = data.content.npcRules.names;
  return names.find((name) => !w.npcs.some((x) => x.name === name)) ?? (names[0] as string);
}

/** Fighting servants: raised undead, beasts, woken trees, kept summons, and companions. */
export const isServant = (n: Pick<Npc, 'kind'>) =>
  n.kind === 'undead' ||
  n.kind === 'beast' ||
  n.kind === 'summon' ||
  n.kind === 'tree' ||
  n.kind === 'companion';

/**
 * A servant's slot (docs/rules-adaptation.md, Formation rules: Servants): in front where it can,
 * the conscious ally with the fewest HP stepping back for it when the front row is full.
 */
function servantSlot(w: World, name: string): { row: number; column: number } | null {
  if (w.npcs.length >= MAX_NPCS) return null;
  const people: (Member | Npc)[] = [...w.members, ...w.npcs];
  const place = servantPlace(
    people.map((x) =>
      'character' in x
        ? { row: x.row, column: x.column, hp: x.character.hp.current, yields: awake(x) }
        : { row: x.row, column: x.column, hp: x.hp, yields: x.hp > 0 && !isServant(x) },
    ),
  );
  if (!place) return null;
  const bumped = place.bump && people[place.bump.index];
  if (place.bump && bumped) {
    Object.assign(bumped, { row: 1, column: place.bump.column });
    const who = 'character' in bumped ? bumped.character.name : bumped.name;
    note(w, `${who} steps back for ${name}.`);
  }
  return { row: place.row, column: place.column };
}

/**
 * A new NPC with rolled hit points, placed in a free slot (a servant by the servant rule, others in
 * front first when `front`); null without room.
 */
export function addNpc(
  w: World,
  data: GameData,
  kind: Npc['kind'],
  type: string,
  monster: string,
  name: string | null,
  front: boolean,
): Npc | null {
  const called = name ?? nextName(w, data);
  const slot = isServant({ kind }) ? servantSlot(w, called) : npcRoom(w, front);
  if (!slot) return null;
  const m = monsterOf(data, monster);
  let hp = 0;
  for (let i = 0; i < m.hitDice; i++) hp += rollDie(w.rng, 8);
  const npc: Npc = {
    id: nextId(w),
    kind,
    type,
    name: called,
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

/** Puts an NPC who left the party back in a free slot, by the same rules as a new one. */
export function placeNpc(w: World, n: Npc, front: boolean): boolean {
  const slot = isServant(n) ? servantSlot(w, n.name) : npcRoom(w, front);
  if (!slot) return false;
  w.npcs.push({ ...n, ...slot, id: nextId(w) });
  return true;
}

export function removeNpc(w: World, id: string): Npc {
  const n = w.npcs.find((x) => x.id === id);
  if (!n) throw new Error(`no NPC ${id}`);
  w.npcs = w.npcs.filter((x) => x !== n);
  return n;
}

/** The Grave Knight's monster id. */
export const GRAVE_KNIGHT = 'grave-knight';

/**
 * Fed and sheltered NPCs heal their hit dice overnight. Hirelings draw no wage (shares.ts). The
 * raised dead never heal, but a Grave Knight is whole again at dusk (vendor/wwn-srd/4.0 Magic and
 * Spellcasting/4.6.0 Necromancer Spells.md).
 */
export function nightForNpcs(w: World, data: GameData, rested: boolean): void {
  for (const n of w.npcs) {
    if (n.kind === 'undead') {
      if (n.type === GRAVE_KNIGHT) n.hp = n.maxHp;
    } else if (rested) n.hp = Math.min(n.maxHp, n.hp + (n.hitDice ?? npcMonster(data, n).hitDice));
  }
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
