// Craftsmen (docs/rules-adaptation.md, Crafting and modifying gear: Craftsmen; Sam's calls). One in
// each town, never a village. Each month a craftsman has a trade pool of crowns for buying loot dice
// and components, a few components for sale, and up to two ready-made magic weapons or suits of
// armor (4.9.3) at the SRD's creation prices (vendor/wwn-srd/4.0 Magic and Spellcasting/4.10.0). What the party pays them goes
// back into the pool, and a quarter of it counts toward the town's spending threshold. The month's
// stock is drawn when the party calls on them, so arriving in town rolls nothing.
import type { Cost, Craftsman, CraftsmanState } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import { toTenths } from '../../rules/economy.ts';
import type { GameData } from '../character/context.ts';
import { fitSize, sizedLine } from '../character/gear.ts';
import { findItem, tenths } from '../character/items.ts';
import { findPeople } from '../character/people.ts';
import type { People } from '../../data/schemas/index.ts';
import { roomFor } from './party-load.ts';
import { componentName, removeComponents } from './components.ts';
import { note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';
import { currentTown, ledger, townHere } from './town-prices.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });
const rules = (data: GameData) => data.content.craftingRules.craftsmen;

/** Everything a craftsman makes magic: their weapons, then their armor. */
export const wares = (c: Craftsman) => [...c.weapons, ...c.armor];

/** "weapon" or "suit of armor", for the journal. */
export const kindWord = (data: GameData, id: string) =>
  findItem(data, id)?.kind === 'armor' ? 'suit of armor' : 'weapon';

export function craftsmanHere(w: World, data: GameData): Craftsman | undefined {
  const town = currentTown(w, data);
  return data.content.craftsmen.find((c) => c.town === town?.id);
}

/** This month's state, or null before the party has called on them this month. */
export function craftsmanState(w: World, data: GameData, c: Craftsman): CraftsmanState | null {
  const st = w.craftsmen[c.id];
  return st && w.day - st.since < data.content.overlandRules.daysPerMonth ? st : null;
}

/** Calls on the town's craftsman, drawing their stock for the month if it is new. */
export function visitCraftsman(w: World, data: GameData): TownResult {
  const c = craftsmanHere(w, data);
  if (!c) return no(`No craftsman works in ${townHere(w, data).name}.`);
  if (craftsmanState(w, data, c)) return { ok: true };
  const tiers = data.content.craftingRules.magic.tiers;
  const total = tiers.reduce((n, t) => n + t.weight, 0);
  const stock = Array.from({ length: w.rng.int(0, rules(data).maxStock) }, () => {
    const all = wares(c);
    const weapon = all[w.rng.int(0, all.length - 1)] as string;
    let pick = w.rng.int(1, total);
    const tier = tiers.find((t) => (pick -= t.weight) <= 0) as (typeof tiers)[number];
    return { weapon, bonus: tier.bonus };
  });
  const parts: Record<string, number> = {};
  // Scrap only comes from salvage.
  const all = data.content.components.filter((c) => c.rarity !== 'scrap');
  for (let i = 0; i < rules(data).partsStock; i++) {
    const id = (all[w.rng.int(0, all.length - 1)] as (typeof all)[number]).id;
    parts[id] = (parts[id] ?? 0) + 1;
  }
  w.craftsmen[c.id] = { since: w.day, pool: c.tradePool, stock, parts };
  return { ok: true };
}

/** The craftsman here and this month's state, once called on. */
function open(w: World, data: GameData): { c: Craftsman; st: CraftsmanState } | TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const c = craftsmanHere(w, data);
  if (!c) return no(`No craftsman works in ${townHere(w, data).name}.`);
  const st = craftsmanState(w, data, c);
  if (!st) return no(`Call on ${c.name} first.`);
  return { c, st };
}

/** Pays a craftsman: back into the trade pool, a share toward the town's threshold. */
function pay(w: World, data: GameData, c: Craftsman, st: CraftsmanState, crowns: number): boolean {
  if (crowns > w.purse) return false;
  w.purse = toTenths(w.purse - crowns);
  st.pool = Math.min(c.tradePool, st.pool + crowns);
  ledger(w, data, townHere(w, data)).spent += crowns * rules(data).thresholdShare;
  return true;
}

/** Sells loot dice one at a time, each paid in full while the trade pool covers it. */
export function sellLootTo(w: World, data: GameData): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const { c, st } = shop;
  if (w.loot.length === 0) return no('The party carries no loot.');
  let paid = 0;
  let sold = 0;
  const left = w.loot.map((d) => ({ ...d }));
  for (const d of left)
    while (d.count > 0) {
      const r = roll(w.rng, { count: 1, sides: d.sides, modifier: 0 }).total;
      if (r > st.pool) break;
      st.pool -= r;
      paid += r;
      sold += 1;
      d.count -= 1;
    }
  w.loot = left.filter((d) => d.count > 0);
  w.purse = toTenths(w.purse + paid);
  note(
    w,
    sold === 0
      ? `${c.name} can't pay for any more loot this month.`
      : `${c.name} buys ${sold} loot ${sold === 1 ? 'die' : 'dice'} for ${paid} crowns.`,
  );
  return { ok: true };
}

const componentOf = (data: GameData, id: string) => {
  const comp = data.content.components.find((x) => x.id === id);
  if (!comp) throw new Error(`unknown component ${id}`);
  return comp;
};

/** What a craftsman pays for a component; they sell at the markup. */
export const componentPrice = (data: GameData, id: string) =>
  rules(data).componentPrices[componentOf(data, id).rarity];

export function sellComponent(w: World, data: GameData, id: string): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const { c, st } = shop;
  const price = componentPrice(data, id);
  if (!w.components[id]) return no(`The party has no ${componentName(data, id).toLowerCase()}.`);
  if (price > st.pool) return no(`${c.name} can't pay ${price} crowns this month.`);
  st.pool -= price;
  w.purse = toTenths(w.purse + price);
  removeComponents(w, [id]);
  note(w, `${c.name} buys ${componentName(data, id).toLowerCase()} for ${price} crowns.`);
  return { ok: true };
}

export function buyComponent(w: World, data: GameData, id: string): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const { c, st } = shop;
  const price = componentPrice(data, id) * rules(data).sellMarkup;
  if (!st.parts[id])
    return no(`${c.name} has no ${componentName(data, id).toLowerCase()} to sell.`);
  if (!roomFor(w, data, id))
    return no(`The party can't carry any more; leave something from the stash first.`);
  if (!pay(w, data, c, st, price)) return no(`That costs ${price} crowns.`);
  const n = (st.parts[id] as number) - 1;
  st.parts = Object.fromEntries(Object.entries({ ...st.parts, [id]: n }).filter(([, v]) => v > 0));
  w.components[id] = (w.components[id] ?? 0) + 1;
  note(w, `The party buys ${componentName(data, id).toLowerCase()} from ${c.name}.`);
  return { ok: true };
}

/** Puts a magic weapon or suit of armor in a member's pack, armor sized for their people. */
export function giveMagic(
  data: GameData,
  m: Member,
  id: string,
  bonus: number,
  ability?: string,
): void {
  const people = findPeople(data, m.character.people) as People;
  const line = {
    id,
    quantity: 1,
    location: 'stowed' as const,
    bonus,
    ...(ability ? { ability } : {}),
  };
  const entry = sizedLine(data, line, fitSize(people));
  m.character = { ...m.character, inventory: [...m.character.inventory, entry] };
}

export const tierOf = (data: GameData, bonus: number) => {
  const tier = data.content.craftingRules.magic.tiers.find((t) => t.bonus === bonus);
  if (!tier) throw new Error(`no +${bonus} tier`);
  return tier;
};

export function partyMember(w: World, id: string): Member {
  const m = w.members.find((x) => x.id === id && !x.dead);
  if (!m) throw new Error(`no living party member ${id}`);
  return m;
}

/** A ready-made magic weapon or suit: its own price plus its bonus's stock price. */
export const magicStockPrice = (data: GameData, id: string, bonus: number) =>
  toTenths(tenths(findItem(data, id)?.cost as Cost) / 10 + tierOf(data, bonus).stockPrice);

/** Buys a ready-made magic weapon or suit of armor from the month's stock. */
export function buyMagic(w: World, data: GameData, index: number, memberId: string): TownResult {
  const shop = open(w, data);
  if ('ok' in shop) return shop;
  const { c, st } = shop;
  const item = st.stock[index];
  if (!item) throw new Error(`no stock line ${index}`);
  const m = partyMember(w, memberId);
  const price = magicStockPrice(data, item.weapon, item.bonus);
  if (!pay(w, data, c, st, price)) return no(`That costs ${price} crowns.`);
  st.stock = st.stock.filter((_, i) => i !== index);
  giveMagic(data, m, item.weapon, item.bonus);
  note(
    w,
    `${m.character.name} buys a +${item.bonus} ${kindWord(data, item.weapon)} from ${c.name}.`,
  );
  return { ok: true };
}

export { open as openCraftsman, pay as payCraftsman };
