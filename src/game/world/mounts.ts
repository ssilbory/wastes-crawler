// Mounts (docs/rules-adaptation.md, Mounts): riding and war mounts kept outside the NPC slots, and
// pack beasts in them. Prices stand in for vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.2.0
// Adventuring Gear.md's beasts; loads follow vendor/wwn-srd/2.0 The Rules of the Game/2.12.0
// Wilderness Exploration and Expeditions.md (2.12.3); hit points are 1d8 per hit die (5.0).
import type { MountType } from '../../data/schemas/index.ts';
import { rollDie } from '../../rules/dice.ts';
import { toTenths } from '../../rules/economy.ts';
import { RESOURCE_DICE, stepDie } from '../../rules/resource-die.ts';
import type { GameData } from '../character/context.ts';
import {
  entryEncumbrance,
  findItem,
  type CatalogItem,
  type InventoryEntry,
} from '../character/items.ts';
import { findPeople } from '../character/people.ts';
import { alive, awake, note } from './members.ts';
import { addNpc, freshName, monsterOf, npcRoom, removeNpc } from './npcs.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import { tradePercent } from './trade.ts';
import { spoils } from './warlords.ts';
import type { Member, Mount, Npc, World } from './types.ts';

const OK: TownResult = { ok: true };
const no = (reason: string): TownResult => ({ ok: false, reason });

export function mountType(data: GameData, id: string): MountType {
  const t = data.content.mountRules.mounts.find((x) => x.id === id);
  if (!t) throw new Error(`unknown mount ${id}`);
  return t;
}

/** The living member riding a mount, if any; a dead or benched rider leaves it unridden. */
export const riderOf = (w: World, m: Mount): Member | undefined =>
  m.rider === null ? undefined : alive(w).find((x) => x.id === m.rider);

/** The mount a member rides, if any. */
export const mountOf = (w: World, memberId: string): Mount | undefined =>
  w.mounts.find((m) => m.rider === memberId && riderOf(w, m) !== undefined);

/** How much gear a mount carries now: less with a rider on its back (SRD 2.12.3). */
export function mountCapacity(w: World, data: GameData, m: Mount): number {
  const t = mountType(data, m.type);
  return riderOf(w, m) ? t.loadRidden : t.loadUnridden;
}

const sizeOf = (data: GameData, m: Member) => findPeople(data, m.character.people)?.size;

/** Centaurs (large peoples) never ride, but count as mounted for slipping away. */
export const rides = (data: GameData, m: Member, t: MountType): boolean => {
  const size = sizeOf(data, m);
  return size !== 'large' && size !== undefined && t.riderSizes.includes(size);
};

/** Every living PC above ground rides or is a centaur, for the slip-away bonus. */
export function allMounted(w: World, data: GameData): boolean {
  if (w.dungeon) return false;
  const party = alive(w);
  return (
    party.length > 0 &&
    party.every(
      (m) => sizeOf(data, m) === 'large' || mountOf(w, m.id) || m.companion?.ridden === true,
    )
  );
}

/** Why a mount's rider can't change here, or null. */
function stableProblem(w: World): string | null {
  if (w.encounter) return 'Settle the encounter first.';
  if (w.dungeon) return 'The mounts wait at the entrance.';
  return null;
}

/** Puts a member on a mount, or with null takes its rider off. */
export function setRider(
  w: World,
  data: GameData,
  mountId: string,
  memberId: string | null,
): TownResult {
  const m = w.mounts.find((x) => x.id === mountId);
  if (!m) throw new Error(`no mount ${mountId}`);
  const problem = stableProblem(w);
  if (problem) return no(problem);
  if (memberId === null) {
    m.rider = null;
    return OK;
  }
  const who = alive(w).find((x) => x.id === memberId);
  if (!who) throw new Error(`no living member ${memberId}`);
  const t = mountType(data, m.type);
  const name = who.character.name;
  if (sizeOf(data, who) === 'large') return no(`${name} is a centaur and rides no one.`);
  if (!rides(data, who, t)) return no(`${m.name} can't carry ${name}.`);
  if (who.companion?.ridden) return no(`${name} rides ${who.companion.name}; get down first.`);
  if (load(data, m) > t.loadRidden)
    return no(`${m.name} carries too much to take a rider; lighten it to ${t.loadRidden}.`);
  for (const other of w.mounts) if (other.rider === memberId) other.rider = null;
  m.rider = memberId;
  return OK;
}

/** The encumbrance a mount or pack beast carries. */
export const load = (data: GameData, holder: Pick<Mount, 'inventory'>) =>
  holder.inventory.reduce((sum, e) => sum + carriedEncumbrance(data, e), 0);

const carriedEncumbrance = (data: GameData, e: InventoryEntry) =>
  entryEncumbrance(data, findItem(data, e.id) as CatalogItem, e);

function nextId(w: World): string {
  let n = 0;
  while (w.mounts.some((x) => x.id === `mount-${n}`)) n++;
  return `mount-${n}`;
}

/** `base`, or `base 2`, `base 3`, … for the first name no mount or NPC has. */
function mountName(w: World, base: string): string {
  const taken = new Set(w.mounts.map((m) => m.name));
  let name = freshName(w, base);
  for (let n = 2; taken.has(name); n++) name = freshName(w, `${base} ${n}`);
  return name;
}

/** A new mount at full hit points; a pack beast takes an NPC slot, or null without room. */
function addMount(w: World, data: GameData, t: MountType): Mount | Npc | null {
  const monster = monsterOf(data, t.monster);
  const name = mountName(w, monster.name);
  if (t.role === 'pack') return addNpc(w, data, 'pack', t.id, t.monster, name, false);
  let hp = 0;
  for (let i = 0; i < monster.hitDice; i++) hp += rollDie(w.rng, 8);
  const m: Mount = { id: nextId(w), type: t.id, name, hp, maxHp: hp, rider: null, inventory: [] };
  w.mounts.push(m);
  return m;
}

/** What a mount costs in this town today. */
export const mountPrice = (w: World, data: GameData, typeId: string) =>
  priceHere(w, data, mountType(data, typeId).price);

/** What a mount fetches here, at the gear sell fraction after the party haggles. */
export function mountSellPrice(w: World, data: GameData, typeId: string): number {
  const price = mountType(data, typeId).price;
  const fraction = data.content.townRules.sellFraction;
  return toTenths((price * fraction * (100 + tradePercent(w, data) + spoils(w, data))) / 100);
}

export function buyMount(w: World, data: GameData, typeId: string): TownResult {
  townHere(w, data);
  if (w.encounter) return no('Settle the encounter first.');
  const t = mountType(data, typeId);
  if (t.role === 'pack' && !npcRoom(w, false)) return no('There is no room in the party.');
  if (!spend(w, data, t.price)) return no(`That costs ${mountPrice(w, data, typeId)} crowns.`);
  const m = addMount(w, data, t) as Mount | Npc;
  note(w, `The party buys ${m.name}.`);
  return OK;
}

/** A mount or a pack beast by id. */
function owned(w: World, id: string): Mount | Npc {
  const m = w.mounts.find((x) => x.id === id) ?? w.npcs.find((x) => x.id === id);
  if (!m || ('kind' in m && m.kind !== 'pack')) throw new Error(`no mount ${id}`);
  return m;
}

function letGo(w: World, m: Mount | Npc): void {
  if ('kind' in m) removeNpc(w, m.id);
  else w.mounts = w.mounts.filter((x) => x !== m);
}

/** Sells a mount or pack beast back to the market, once its load is taken off. */
export function sellMount(w: World, data: GameData, id: string): TownResult {
  townHere(w, data);
  if (w.encounter) return no('Settle the encounter first.');
  const m = owned(w, id);
  if (m.inventory.length > 0) return no(`Take ${m.name}'s load first.`);
  const price = mountSellPrice(w, data, m.type);
  letGo(w, m);
  w.purse = toTenths(w.purse + price);
  note(w, `${m.name} is sold for ${price} crowns.`);
  return OK;
}

/** Sets a mount loose anywhere above ground, once its load is taken off. */
export function releaseMount(w: World, data: GameData, id: string): TownResult {
  const m = owned(w, id);
  const problem = stableProblem(w);
  if (problem && !('kind' in m)) return no(problem);
  if (m.inventory.length > 0) return no(`Take ${m.name}'s load first.`);
  letGo(w, m);
  note(w, `${m.name} is set loose and wanders off into the wastes.`);
  return OK;
}

/** Mounts heal their hit dice each night the party rests fed and sheltered, as NPCs do. */
export function nightForMounts(w: World, data: GameData, rested: boolean): void {
  if (!rested) return;
  for (const m of w.mounts) {
    const hd = monsterOf(data, mountType(data, m.type).monster).hitDice;
    m.hp = Math.min(m.maxHp, m.hp + hd);
  }
}

/** The mount an offered beast can be kept as, if any. */
export const tamesInto = (data: GameData, monsterId: string): MountType | undefined =>
  data.content.mountRules.mounts.find((t) => t.tameFrom.includes(monsterId));

/** Awake members with Animal Ken, who can keep an offered beast as a mount. */
export const tamers = (w: World, data: GameData): Member[] =>
  w.members.filter(
    (m) => awake(m) && m.character.skills[data.content.skillRules.animalKen.skill] !== undefined,
  );

/**
 * Keeps the beast offered after a helpful parley as a mount, for the same rations as winning it
 * over as a beast; the handler rides it if they can and don't already ride.
 */
export function keepAsMount(w: World, data: GameData, handlerId: string): TownResult {
  const e = w.encounter;
  const t = e?.beast ? tamesInto(data, e.beast) : undefined;
  if (!e?.beast || !t) return no('No beast here would carry a rider.');
  const handler = tamers(w, data).find((m) => m.id === handlerId);
  if (!handler) return no('Choose someone awake with Animal Ken.');
  const steps = monsterOf(data, e.beast).hitDice;
  if (RESOURCE_DICE.indexOf(w.rations) < steps)
    return no(`Taming it takes ${steps} steps of the rations die.`);
  if (t.role === 'pack' && !npcRoom(w, false)) return no('There is no room in the party.');
  const m = addMount(w, data, t) as Mount | Npc;
  w.rations = stepDie(w.rations, -steps);
  delete e.beast;
  if (!('kind' in m) && rides(data, handler, t) && !mountOf(w, handler.id)) m.rider = handler.id;
  note(w, `${handler.character.name} tames ${m.name}, won over with ${steps} steps of rations.`);
  return OK;
}
