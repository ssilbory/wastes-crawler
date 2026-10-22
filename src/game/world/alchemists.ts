// Alchemists (docs/rules-adaptation.md, Potions: Alchemists; Sam's calls): one in each town with a
// craftsman, never a village. Each month an alchemist has a few ready-made potions from their wares,
// drawn when the party calls on them, at four times the brewing cost; and they brew any of their
// wares to order at the brewing cost a dose, ready in the SRD's week (vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.10.0 Creating Magic Items.md), to be collected in their town. Purchases and
// orders are town purchases, through the spending threshold.
import type { Alchemist, AlchemistState } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { putLine } from '../character/stacks.ts';
import { brewItem, reagentsListed, recipeOf } from './brewing.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import { currentTown, priceHere, spend, townHere } from './town.ts';
import type { Member, World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });
const rules = (data: GameData) => data.content.alchemy;

export function alchemistHere(w: World, data: GameData): Alchemist | undefined {
  const town = currentTown(w, data);
  return rules(data).alchemists.find((a) => a.town === town?.id);
}

/** This month's state, or null before the party has called on them this month. */
export function alchemistState(w: World, data: GameData, a: Alchemist): AlchemistState | null {
  const st = w.alchemists[a.id];
  return st && w.day - st.since < data.content.overlandRules.daysPerMonth ? st : null;
}

/** Calls on the town's alchemist, drawing the month's stock if it is new. */
export function visitAlchemist(w: World, data: GameData): TownResult {
  const a = alchemistHere(w, data);
  if (!a) return no(`No alchemist works in ${townHere(w, data).name}.`);
  if (alchemistState(w, data, a)) return { ok: true };
  // Every ware stocks at least now and then, however rarely it drops.
  const weights = a.wares.map((id) => Math.max(1, recipeOf(data, id).weight));
  const total = weights.reduce((n, x) => n + x, 0);
  const stock: Record<string, number> = {};
  for (let i = w.rng.int(0, rules(data).maxStock); i > 0; i--) {
    let pick = w.rng.int(1, total);
    const id = a.wares[weights.findIndex((x) => (pick -= x) <= 0)] as string;
    stock[id] = (stock[id] ?? 0) + w.rng.int(1, rules(data).maxDoses);
  }
  w.alchemists[a.id] = { since: w.day, stock };
  return { ok: true };
}

function open(w: World, data: GameData): { a: Alchemist; st: AlchemistState } | TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const a = alchemistHere(w, data);
  if (!a) return no(`No alchemist works in ${townHere(w, data).name}.`);
  const st = alchemistState(w, data, a);
  if (!st) return no(`Call on ${a.name} first.`);
  return { a, st };
}

function member(w: World, id: string): Member {
  const m = w.members.find((x) => x.id === id && !x.dead);
  if (!m) throw new Error(`no living party member ${id}`);
  return m;
}

function give(m: Member, item: string, doses: number): void {
  const inventory = putLine(m.character.inventory, {
    id: item,
    quantity: doses,
    location: 'stowed',
  });
  m.character = { ...m.character, inventory };
}

/** Listed crowns for one ready-made dose. */
export const stockListed = (data: GameData, item: string) =>
  reagentsListed(data, item) * rules(data).stockMultiplier;

export function buyPotion(w: World, data: GameData, item: string, memberId: string): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const { a, st } = shop;
  const left = st.stock[item];
  if (!left) return no(`${a.name} has no ${brewItem(data, item).name} left.`);
  const m = member(w, memberId);
  const listed = stockListed(data, item);
  if (!spend(w, data, listed)) return no(`That costs ${priceHere(w, data, listed)} crowns.`);
  st.stock = Object.fromEntries(
    Object.entries({ ...st.stock, [item]: left - 1 }).filter(([, n]) => n > 0),
  );
  give(m, item, 1);
  note(w, `${m.character.name} buys a ${brewItem(data, item).name} from ${a.name}.`);
  return { ok: true };
}

/** Orders doses of one of the alchemist's wares, paid now. */
export function orderBrew(w: World, data: GameData, item: string, doses: number): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const { a } = shop;
  if (!a.wares.includes(item)) throw new Error(`${a.name} doesn't brew ${item}`);
  if (doses < 1) throw new Error(`can't order ${doses} doses`);
  const listed = reagentsListed(data, item) * doses;
  if (!spend(w, data, listed)) return no(`${a.name} asks ${priceHere(w, data, listed)} crowns.`);
  const days = rules(data).brewDays;
  w.brewOrders.push({ alchemist: a.id, item, doses, readyDay: w.day + days });
  const name = brewItem(data, item).name;
  note(w, `${a.name} will brew ${doses} × ${name}: ready in ${daysText(days)}.`);
  return { ok: true };
}

/** Collects a finished order in its alchemist's town. */
export function collectBrew(w: World, data: GameData, index: number, memberId: string): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const order = w.brewOrders[index];
  if (!order || order.alchemist !== shop.a.id) throw new Error(`no order ${index} here`);
  if (w.day < order.readyDay) return no(`Not ready for ${daysText(order.readyDay - w.day)}.`);
  const m = member(w, memberId);
  w.brewOrders = w.brewOrders.filter((_, i) => i !== index);
  give(m, order.item, order.doses);
  const name = brewItem(data, order.item).name;
  note(w, `${m.character.name} collects ${order.doses} × ${name} from ${shop.a.name}.`);
  return { ok: true };
}
