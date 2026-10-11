// Crafting gear (docs/rules-adaptation.md, Crafting and modifying gear; vendor/wwn-srd/2.0 The Rules
// of the Game/2.8.0 Crafting and Modifying Gear.md, 2.8.1). A PC with Craft or the Artisan focus
// buys parts in a settlement and builds one item at a time: jury-rigged at a quarter of the cost and
// half the time, normal at market cost, or mastercrafted at ten times the cost and twice the time.
// The work goes on in a town's workshop, or in camp shifts out in the wilds for a crafter carrying
// crafting tools, a portable workshop in the SRD's sense (Sam's calls).
import type { People, Project } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { fitSize, sizedLine, type Size } from '../character/gear.ts';
import { entryPrice, findItem, type CatalogItem, type InventoryEntry } from '../character/items.ts';
import { findPeople } from '../character/people.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import { daysText } from './wording.ts';
import { completeMod } from './mods.ts';
import { regionMap } from './region.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { Member, World } from './types.ts';

export type Tier = Project['quality'];

const peopleOf = (data: GameData, m: Member) => findPeople(data, m.character.people) as People;
type Craftable = Extract<CatalogItem, { kind: 'weapon' | 'armor' | 'shield' | 'gear' }>;

const no = (reason: string): TownResult => ({ ok: false, reason });

/** SRD 2.8.1: an artisan; here, anyone with the Craft skill or the Artisan focus. */
export const canCraft = (m: Member) =>
  Object.hasOwn(m.character.skills, 'craft') || m.character.foci.some((f) => f.id === 'artisan');

/** Everything with a market price except gear bundles, which are bought, not built. */
export function craftable(data: GameData): Craftable[] {
  return (['weapon', 'armor', 'shield', 'gear'] as const).flatMap((kind) =>
    craftableOfKind(data, kind),
  );
}

function craftableOfKind(data: GameData, kind: Craftable['kind']): Craftable[] {
  const ids = {
    weapon: data.srd.weapons.map((x) => x.id),
    armor: data.srd.armor.filter((x) => x.category !== 'shield').map((x) => x.id),
    shield: data.content.shields.map((x) => x.id),
    gear: data.srd.gear.map((x) => x.id),
  }[kind];
  return ids.flatMap((id) => {
    const item = findItem(data, id) as Craftable;
    return item.cost ? [item] : [];
  });
}

/** Quality tiers matter only for weapons, armor, and shields; other gear is built normal. */
export const tiersFor = (item: Craftable): Tier[] =>
  item.kind === 'gear' ? ['normal'] : ['jury-rigged', 'normal', 'mastercrafted'];

export function buildDays(data: GameData, item: Craftable, tier: Tier): number {
  const rules = data.content.craftingRules;
  const time = tier === 'normal' ? 1 : rules.quality[tier].time;
  return Math.max(1, Math.ceil(rules.buildDays[item.kind] * time));
}

const entryOf = (item: Craftable, tier: Tier): InventoryEntry => ({
  id: item.id,
  quantity: 1,
  location: 'stowed',
  ...(tier === 'normal' ? {} : { quality: tier }),
});

/** The listed crowns the parts cost: the item's market value at that tier. */
export const partsListed = (data: GameData, item: Craftable, tier: Tier) =>
  entryPrice(data, item, entryOf(item, tier)) / 10;

export const tierName = (tier: Tier) => (tier === 'normal' ? '' : `${tier} `);

export { daysText } from './wording.ts';

/** Every member in the world, on the bench or in the party. */
const anyone = (w: World, id: string) =>
  [...w.members, ...w.benched].find((m) => m.id === id) as Member;

/**
 * Starts a build. `size` is for armor only (docs/rules-adaptation.md, Small armor); left out, it
 * fits the crafter's own people, and any crafter can ask for either size.
 */
export function startProject(
  w: World,
  data: GameData,
  crafterId: string,
  itemId: string,
  tier: Tier,
  size?: Size,
): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  townHere(w, data);
  const m = w.members.find((x) => x.id === crafterId && !x.dead);
  if (!m) throw new Error(`no living party member ${crafterId}`);
  const item = craftable(data).find((i) => i.id === itemId);
  if (!item) throw new Error(`${itemId} can't be crafted`);
  const name = m.character.name;
  if (!canCraft(m)) return no(`${name} has no Craft skill.`);
  if (w.projects.some((p) => p.crafter === m.id)) return no(`${name} is already making something.`);
  if (!tiersFor(item).includes(tier)) return no(`${item.name} is only ever made normal.`);
  if (size === 'small' && item.kind !== 'armor') return no(`${item.name} isn't made small.`);
  const listed = partsListed(data, item, tier);
  const price = priceHere(w, data, listed);
  if (!spend(w, data, listed)) return no(`The parts cost ${price} crowns.`);
  const small = sizedLine(data, entryOf(item, tier), size ?? fitSize(peopleOf(data, m)));
  const days = buildDays(data, item, tier);
  w.projects.push({
    crafter: m.id,
    kind: 'gear',
    item: item.id,
    quality: tier,
    ...(small.small ? { small: true as const } : {}),
    daysLeft: days,
    town: townHere(w, data).id,
    staying: false,
  });
  note(w, `${name} starts on a ${tierName(tier)}${item.name}: ${daysText(days)} of work.`);
  return { ok: true };
}

/**
 * Work on a project, a day unless said otherwise. Each whole day finished is worth XP to the
 * crafter so they keep pace with those out fighting; the finished item goes to the crafter's pack.
 */
export function workOn(w: World, data: GameData, p: Project, days = 1): void {
  const crafter = anyone(w, p.crafter);
  const left = Math.max(0, p.daysLeft - days);
  // XP comes in half points, so a half day's shift pays when the day it starts is done.
  const finished = Math.ceil(p.daysLeft) - Math.ceil(left);
  const xp = crafter.character.xp + finished * data.content.craftingRules.xpPerDay;
  crafter.character = { ...crafter.character, xp };
  p.daysLeft = left;
  if (p.daysLeft > 0) return;
  w.projects = w.projects.filter((x) => x !== p);
  if (p.kind !== 'gear') {
    completeMod(w, data, p);
    return;
  }
  const m = anyone(w, p.crafter);
  const item = findItem(data, p.item) as Craftable;
  const entry: InventoryEntry = {
    ...entryOf(item, p.quality),
    ...(p.small ? { small: true as const } : {}),
    // The creator's first mod on a mastercrafted item needs no maintenance (SRD 2.8.1).
    ...(p.quality === 'mastercrafted' ? { maker: m.character.id } : {}),
  };
  const inventory = m.character.inventory;
  // Plain gear stacks; weapons, armor, and shields keep a line each for their tier.
  const same =
    item.kind === 'gear'
      ? inventory.findIndex((e) => e.id === entry.id && e.location === 'stowed')
      : -1;
  m.character = {
    ...m.character,
    inventory:
      same < 0
        ? [...inventory, entry]
        : inventory.map((e, i) => (i === same ? { ...e, quantity: e.quantity + 1 } : e)),
  };
  note(w, `${m.character.name} finishes the ${tierName(p.quality)}${item.name}.`);
}

export function abandonProject(w: World, data: GameData, crafterId: string): TownResult {
  const p = w.projects.find((x) => x.crafter === crafterId);
  if (!p) return no('Nothing is under way.');
  w.projects = w.projects.filter((x) => x !== p);
  const item = findItem(data, p.item) as Craftable;
  note(w, `${anyone(w, crafterId).character.name} gives up on the ${item.name}.`);
  return { ok: true };
}

/** A town's workshop; villages have none. */
export function workshopHere(w: World, data: GameData): { owned: boolean } | null {
  const town = townHere(w, data);
  return town.size === 'village' ? null : { owned: w.workshops.includes(town.id) };
}

export function buyWorkshop(w: World, data: GameData): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const shop = workshopHere(w, data);
  const town = townHere(w, data);
  if (!shop) return no(`${town.name} has no workshop.`);
  if (shop.owned) return no(`The party already owns the workshop in ${town.name}.`);
  const listed = data.content.craftingRules.workshop.price;
  const price = priceHere(w, data, listed);
  if (!spend(w, data, listed)) return no(`The workshop costs ${price} crowns.`);
  w.workshops.push(town.id);
  note(w, `The party buys the workshop in ${town.name}.`);
  return { ok: true };
}

/** Whether a member carries crafting tools, anywhere on them. */
export const hasTools = (data: GameData, m: Member) =>
  m.character.inventory.some((e) => e.id === data.content.craftingRules.tools.id);

/**
 * The gear a party member could work on in a camp shift out in the wilds: their own build, not a
 * mod (mods need the workshop), with crafting tools in their pack. Null if there is none.
 */
export function campProject(w: World, data: GameData, m: Member): Project | null {
  if (regionMap(data, w.region).siteAt(w.position) !== undefined || w.dungeon) return null;
  const p = w.projects.find((x) => x.crafter === m.id && x.kind === 'gear' && !x.staying);
  return p && hasTools(data, m) ? p : null;
}

/** A camp quarter spent crafting: half a day off the build (Sam's call). */
export function craftShift(w: World, data: GameData, m: Member): void {
  const p = campProject(w, data, m);
  const name = m.character.name;
  if (!p) {
    note(w, `${name} has nothing to work on here${hasTools(data, m) ? '' : ' without tools'}.`);
    return;
  }
  workOn(w, data, p, data.content.craftingRules.shiftDays);
  if (w.projects.includes(p)) note(w, `${name} works on the ${itemName(data, p)}.`);
}

const itemName = (data: GameData, p: Project) =>
  `${tierName(p.quality)}${(findItem(data, p.item) as Craftable).name}`;

/** The crafting bus listener: each day, crafters who stayed behind at a workshop work a day. */
export function craftingListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind !== 'day-passed') return;
  for (const p of [...w.projects]) if (p.staying) workOn(w, data, p);
}
