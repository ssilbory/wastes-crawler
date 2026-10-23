// Brewing potions (docs/rules-adaptation.md, Potions: Brewing; vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.10.0 Creating Magic Items.md, 4.10.2): a member with Alchemy and an alchemist's
// kit buys the reagents in a settlement, at half the potion's brewing cost, and puts in the
// recipe's components from the party's stash (Sam's calls), then brews a batch over a week, in a
// town's workshop or in camp shifts with the kit, like any build. When the work is done they roll Int/Alchemy against the recipe's
// difficulty, +1 for two doses or +2 for four; another member with Alchemy helps, as the SRD's
// apprentice, for +1. A failed brew is lost with its reagents (Sam's call: single-use items take
// no flaws).
import type { Cost, Project } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { findItem, tenths, type CatalogItem } from '../character/items.ts';
import { toTenths } from '../../rules/economy.ts';
import { partsText, pickComponents, removeComponents } from './components.ts';
import { putLine } from '../character/stacks.ts';
import { memberCheck, note } from './members.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { Member, World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });
const rules = (data: GameData) => data.content.alchemy;

/** Whether a member can brew: they have the Alchemy skill at any level. */
export const canBrew = (data: GameData, m: Member) =>
  Object.hasOwn(m.character.skills, rules(data).skill);

export const recipeOf = (data: GameData, item: string) => {
  const r = rules(data).recipes.find((x) => x.item === item);
  if (!r) throw new Error(`no recipe for ${item}`);
  return r;
};

const batchOf = (data: GameData, doses: number) => {
  const b = rules(data).batches.find((x) => x.doses === doses);
  if (!b) throw new Error(`no batch of ${doses}`);
  return b;
};

/** The recipe's item; content checks keep recipes to real items. */
export const brewItem = (data: GameData, item: string) => findItem(data, item) as CatalogItem;

/** Listed crowns a batch's reagents cost: the item's cost, whatever the batch (SRD 4.10.2). */
export const reagentsListed = (data: GameData, item: string) =>
  // Recipes name potions and the antidote, which always have a price.
  tenths(brewItem(data, item).cost as Cost) / 10;

/** Crowns the party pays to brew a batch: its share of the reagents' listed price (Sam's call). */
export const brewCost = (data: GameData, item: string) =>
  toTenths(reagentsListed(data, item) * rules(data).makeFraction);

/** Whether a member carries an alchemist's kit, anywhere on them. */
export const hasKit = (data: GameData, m: Member) =>
  m.character.inventory.some((e) => e.id === rules(data).kit.id);

/** The check's difficulty for a batch. */
export const brewDifficulty = (data: GameData, item: string, doses: number) =>
  recipeOf(data, item).difficulty + batchOf(data, doses).difficulty;

export function startBrew(
  w: World,
  data: GameData,
  crafterId: string,
  item: string,
  doses: number,
): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  const m = w.members.find((x) => x.id === crafterId && !x.dead);
  if (!m) throw new Error(`no living party member ${crafterId}`);
  const name = m.character.name;
  // Unknown recipes and batch sizes are caller errors.
  brewDifficulty(data, item, doses);
  if (!canBrew(data, m)) return no(`${name} has no Alchemy skill.`);
  if (!hasKit(data, m)) return no(`${name} needs an ${rules(data).kit.name}.`);
  if (w.projects.some((p) => p.crafter === m.id)) return no(`${name} is already making something.`);
  const needs = recipeOf(data, item).components;
  const parts = pickComponents(w, data, needs);
  if (!parts) return no(`It needs ${partsText(needs)}.`);
  const listed = brewCost(data, item);
  const price = priceHere(w, data, listed);
  if (!spend(w, data, listed)) return no(`The reagents cost ${price} crowns.`);
  removeComponents(w, parts);
  const days = rules(data).brewDays;
  w.projects.push({
    crafter: m.id,
    kind: 'brew',
    item,
    quality: 'normal',
    doses,
    daysLeft: days,
    town: town.id,
    staying: false,
  });
  const what = brewItem(data, item).name;
  note(w, `${name} starts brewing ${doses} × ${what}: ${daysText(days)} of work.`);
  return { ok: true };
}

/** The work is done: the brewer rolls, and the batch goes to their pack or is lost. */
export function completeBrew(w: World, data: GameData, p: Project, brewer: Member): void {
  // startBrew always sets the batch size.
  const doses = p.doses as number;
  const helper = w.members.some((m) => !m.dead && m !== brewer && canBrew(data, m));
  const difficulty = brewDifficulty(data, p.item, doses) - (helper ? rules(data).assistBonus : 0);
  const check = memberCheck(w, data, brewer, rules(data).skill, rules(data).attributes, difficulty);
  const name = brewItem(data, p.item).name;
  const who = brewer.character.name;
  if (!check.success) {
    note(w, `${who}'s ${name} spoils in the pot; the reagents are lost.`);
    return;
  }
  const inventory = putLine(brewer.character.inventory, {
    id: p.item,
    quantity: doses,
    location: 'stowed',
  });
  brewer.character = { ...brewer.character, inventory };
  note(w, `${who} brews ${doses} × ${name}.`);
}
