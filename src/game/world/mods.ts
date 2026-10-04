// Mods (docs/rules-adaptation.md, Crafting and modifying gear; vendor/wwn-srd/2.0 The Rules of the
// Game/2.8.0 Crafting and Modifying Gear.md, 2.8.2). An Expert or Partial Expert with Craft-1, or
// anyone with the Artisan focus, builds a mod onto one weapon or suit of armor at a town workshop,
// paying exact loot dice and components (Sam's call). Building takes a week per Craft level of the
// mod, halved because workshop work is full time, and halved again with a Craft assistant in the
// party. Any loot dice short can be paid in crowns at their highest face (Sam's call). Stripping a
// mod off takes a day and gives its components back.
import type { Mod, Project } from '../../data/schemas/index.ts';
import { payDice } from '../../rules/loot-dice.ts';
import type { GameData } from '../character/context.ts';
import { findItem, type CatalogItem, type InventoryEntry } from '../character/items.ts';
import { addComponents, pickComponents, removeComponents } from './components.ts';
import { note } from './members.ts';
import { daysText } from './wording.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { Member, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export function modOf(data: GameData, id: string): Mod {
  const mod = data.content.mods.find((m) => m.id === id);
  if (!mod) throw new Error(`unknown mod ${id}`);
  return mod;
}

/** Craft level for mods: the Artisan focus counts it one higher, up to 5 (SRD 1.6.0). */
export function craftLevel(m: Member): number | null {
  const craft = m.character.skills.craft;
  const artisan = m.character.foci.some((f) => f.id === 'artisan');
  if (craft === undefined) return artisan ? 1 : null;
  return Math.min(5, craft + (artisan ? 1 : 0));
}

/** SRD 2.8.0: Experts and Partial Experts with Craft-1, or anyone with the Artisan focus. */
export function canMod(m: Member): boolean {
  if (m.character.foci.some((f) => f.id === 'artisan')) return true;
  const expert = Object.entries(m.character.classes.levels).some(
    ([cls, level]) => level >= 1 && cls.includes('expert'),
  );
  return expert && (m.character.skills.craft ?? -1) >= 1;
}

/** Why a mod can't go on an inventory line, or null if it can. */
export function modMisfit(data: GameData, entry: InventoryEntry, mod: Mod): string | null {
  const item = findItem(data, entry.id) as CatalogItem;
  const kind = item.kind === 'weapon' || item.kind === 'armor' ? item.kind : null;
  if (!kind || !mod.targets.includes(kind)) return `${mod.name} doesn't fit a ${item.name}.`;
  if (mod.rangedOnly && !(item.kind === 'weapon' && item.weapon.range))
    return `${mod.name} needs a ranged or thrown weapon.`;
  if (entry.quality === 'jury-rigged') return 'Jury-rigged gear can’t be modded.';
  if (entry.mods?.some((m) => m.id === mod.id)) return `It already has ${mod.name}.`;
  return null;
}

const everyone = (w: World) => [...w.members, ...w.benched];

/** The member and line holding a serial, if it is still in the world. */
function holder(w: World, serial: string): { m: Member; index: number } | null {
  for (const m of everyone(w)) {
    const index = m.character.inventory.findIndex((e) => e.serial === serial);
    if (index >= 0) return { m, index };
  }
  return null;
}

/** Gives one unit of a line its own serial, splitting it off a stack. */
function mark(w: World, owner: Member, index: number): string {
  const entry = owner.character.inventory[index] as InventoryEntry;
  if (entry.serial) return entry.serial;
  const used = everyone(w).flatMap((m) =>
    m.character.inventory.flatMap((e) => (e.serial ? [Number(e.serial.slice(1))] : [])),
  );
  const serial = `s${Math.max(0, ...used) + 1}`;
  const one = { ...entry, quantity: 1, serial };
  const inventory = [...owner.character.inventory];
  inventory.splice(
    index,
    1,
    ...(entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }, one] : [one]),
  );
  owner.character = { ...owner.character, inventory };
  return serial;
}

interface Work {
  crafter: Member;
  owner: Member;
  entry: InventoryEntry;
  mod: Mod;
}

/** The checks building and stripping share: in a workshop town, a free crafter with the skill. */
function prepare(
  w: World,
  data: GameData,
  crafterId: string,
  ownerId: string,
  index: number,
  modId: string,
): Work | TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  if (town.size === 'village') return no(`${town.name} has no workshop.`);
  const crafter = w.members.find((x) => x.id === crafterId && !x.dead);
  const owner = w.members.find((x) => x.id === ownerId);
  const entry = owner?.character.inventory[index];
  if (!crafter || !owner || !entry) throw new Error('no such crafter or item');
  const mod = modOf(data, modId);
  const name = crafter.character.name;
  if (!canMod(crafter)) return no(`${name} can't build mods.`);
  if ((craftLevel(crafter) as number) < mod.minCraft)
    return no(`${mod.name} needs Craft-${mod.minCraft}.`);
  if (w.projects.some((p) => p.crafter === crafter.id))
    return no(`${name} is already making something.`);
  return { crafter, owner, entry, mod };
}

function begin(
  w: World,
  data: GameData,
  work: Work,
  index: number,
  extra: Partial<Project>,
  days: number,
): void {
  const target = mark(w, work.owner, index);
  w.projects.push({
    crafter: work.crafter.id,
    kind: 'mod',
    item: work.entry.id,
    mod: work.mod.id,
    target,
    quality: 'normal',
    daysLeft: days,
    town: townHere(w, data).id,
    staying: false,
    ...extra,
  });
}

const itemName = (data: GameData, id: string) => (findItem(data, id) as CatalogItem).name;

export function startMod(
  w: World,
  data: GameData,
  crafterId: string,
  ownerId: string,
  index: number,
  modId: string,
  /** Spend carried dice first, or pay the whole cost in crowns. */
  payWith: 'dice' | 'crowns' = 'dice',
): TownResult {
  const work = prepare(w, data, crafterId, ownerId, index, modId);
  if ('ok' in work) return work;
  const { crafter, entry, mod } = work;
  const misfit = modMisfit(data, entry, mod);
  if (misfit) return no(misfit);
  const parts = pickComponents(w, data, mod.components);
  if (!parts)
    return no(
      `${mod.name} needs ${mod.components.map((c) => `${c.count} ${c.type}`).join(' and ')}.`,
    );
  // Dice short are paid in crowns at their highest face, through the town's prices (Sam's call).
  const dice = payDice(w.loot, mod.loot, payWith === 'dice');
  const price = priceHere(w, data, dice.crowns);
  if (!spend(w, data, dice.crowns))
    return no(
      `${mod.name} takes ${mod.loot.count}d${mod.loot.sides} in loot dice; the ${dice.short} short cost ${price} crowns.`,
    );
  w.loot = dice.left;
  removeComponents(w, parts);
  const rules = data.content.craftingRules.mods;
  const assistant = w.members.some(
    (x) => x !== crafter && !x.dead && x.character.skills.craft !== undefined,
  );
  const days = Math.max(1, Math.ceil((rules.daysPerLevel * mod.minCraft) / (assistant ? 4 : 2)));
  begin(w, data, work, index, { components: parts }, days);
  note(
    w,
    `${crafter.character.name} starts building ${mod.name} onto ${work.owner.character.name}'s ${itemName(data, entry.id)}${dice.crowns > 0 ? `, ${price} crowns paid for dice` : ''}: ${daysText(days)} of work.`,
  );
  return { ok: true };
}

export function startStrip(
  w: World,
  data: GameData,
  crafterId: string,
  ownerId: string,
  index: number,
  modId: string,
): TownResult {
  const work = prepare(w, data, crafterId, ownerId, index, modId);
  if ('ok' in work) return work;
  if (!work.entry.mods?.some((m) => m.id === modId)) return no(`It has no ${work.mod.name}.`);
  begin(w, data, work, index, { kind: 'strip' }, data.content.craftingRules.mods.stripDays);
  note(w, `${work.crafter.character.name} starts stripping ${work.mod.name} off.`);
  return { ok: true };
}

/** Finishes installing or stripping a mod, if the item is still somewhere in the world. */
export function completeMod(w: World, data: GameData, p: Project): void {
  const mod = modOf(data, p.mod as string);
  const crafter = everyone(w).find((m) => m.id === p.crafter) as Member;
  const found = holder(w, p.target as string);
  const item = itemName(data, p.item);
  if (!found) {
    note(w, `The ${item} is gone, and the work on ${mod.name} with it.`);
    return;
  }
  const { m, index } = found;
  const entry = m.character.inventory[index] as InventoryEntry;
  let mods = entry.mods ?? [];
  if (p.kind === 'strip') {
    const off = mods.find((x) => x.id === mod.id);
    mods = mods.filter((x) => x !== off);
    addComponents(w, off?.components ?? []);
    note(w, `${crafter.character.name} strips ${mod.name} off the ${item}.`);
  } else {
    // SRD 2.8.1: the creator's first mod on a mastercrafted item needs no maintenance.
    const free =
      entry.quality === 'mastercrafted' &&
      entry.maker === crafter.character.id &&
      !mods.some((x) => x.free);
    mods = [
      ...mods,
      {
        id: mod.id,
        components: p.components as string[],
        ...(free ? { free: true as const } : {}),
      },
    ];
    note(w, `${crafter.character.name} finishes ${mod.name} on the ${item}.`);
  }
  const next: InventoryEntry = { ...entry, mods };
  if (mods.length === 0) delete next.mods;
  m.character = {
    ...m.character,
    inventory: m.character.inventory.map((e, i) => (i === index ? next : e)),
  };
}
