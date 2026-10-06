// Crafting gear (docs/rules-adaptation.md, Crafting and modifying gear; vendor/wwn-srd/2.0 The Rules
// of the Game/2.8.0 Crafting and Modifying Gear.md, 2.8.1). A PC with Craft or the Artisan focus
// buys parts in a settlement and builds one item at a time: jury-rigged at a quarter of the cost and
// half the time, normal at market cost, or mastercrafted at ten times the cost and twice the time.
// The work goes on in a town's workshop, or in a made camp out in the wilds (Sam's call).
import type { People, Project } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { sizeEntries } from '../character/gear.ts';
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

export function startProject(
  w: World,
  data: GameData,
  crafterId: string,
  itemId: string,
  tier: Tier,
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
  const listed = partsListed(data, item, tier);
  const price = priceHere(w, data, listed);
  if (!spend(w, data, listed)) return no(`The parts cost ${price} crowns.`);
  const [sized] = sizeEntries(
    data,
    [entryOf(item, tier)],
    findPeople(data, m.character.people) as People,
  );
  const days = buildDays(data, item, tier);
  w.projects.push({
    crafter: m.id,
    kind: 'gear',
    item: item.id,
    quality: tier,
    ...(sized?.small ? { small: true as const } : {}),
    daysLeft: days,
    town: townHere(w, data).id,
    staying: false,
  });
  note(w, `${name} starts on a ${tierName(tier)}${item.name}: ${daysText(days)} of work.`);
  return { ok: true };
}

/**
 * A day of work on a project, worth XP to the crafter so they keep pace with those out fighting;
 * the finished item goes to the crafter's pack.
 */
export function workOn(w: World, data: GameData, p: Project): void {
  const crafter = anyone(w, p.crafter);
  const xp = crafter.character.xp + data.content.craftingRules.xpPerDay;
  crafter.character = { ...crafter.character, xp };
  p.daysLeft -= 1;
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

/**
 * The crafting bus listener: each day, crafters who stayed behind work a day, and crafters in the
 * party work a day if the party made camp out in the wilds.
 */
export function craftingListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind !== 'day-passed') return;
  const wilds = regionMap(data, w.region).siteAt(w.position) === undefined;
  for (const p of [...w.projects]) {
    const inParty = w.members.some((m) => m.id === p.crafter && !m.dead);
    // Only plain gear is worked on in camp; mods need the workshop (Sam's call).
    const camp = p.kind === 'gear' && inParty && wilds && w.camp === 'made';
    if (p.staying || camp) workOn(w, data, p);
  }
}
