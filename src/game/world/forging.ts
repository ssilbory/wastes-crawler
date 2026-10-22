// Forging magic weapons and armor (docs/rules-adaptation.md, Potions, scrolls, and magic devices:
// Forged magic and Abilities; vendor/wwn-srd/4.0 Magic and Spellcasting/4.10.0 Creating Magic
// Items.md). A member with Magic 1 and Craft 1 (or the Artisan focus) forges a +1 to +3 weapon or
// suit of body armor at a craftsman's commission price, components, and days, with a special
// ability for its own price, components, and days besides. When the work is done they roll
// Int/Magic against 10, 12, or 14, 2 more with an ability; another member who could forge helps
// for +1. A failure waits on the forger: start over at full price and time (the components are
// kept), or go on with a flaw in the item and try again in half the time at a cumulative +1 — once
// per flaw that fits it, after which the flaws are intolerable.
import type { Ability, Project } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { fitSize, sizedLine, type Size } from '../character/gear.ts';
import { findItem, type InventoryEntry } from '../character/items.ts';
import { findPeople } from '../character/people.ts';
import type { People } from '../../data/schemas/index.ts';
import { pickComponents, removeComponents } from './components.ts';
import { tierOf } from './craftsmen.ts';
import { memberCheck, note } from './members.ts';
import { craftLevel } from './mods.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { Member, World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });
const rules = (data: GameData) => data.content.forging;

export const canForge = (data: GameData, m: Member) =>
  (m.character.skills[rules(data).skill] ?? -1) >= rules(data).magicLevel &&
  (craftLevel(m) ?? -1) >= rules(data).craftLevel;

/** Priced SRD weapons and body armor: what can be forged. */
export function forgeable(data: GameData): string[] {
  return [
    ...data.srd.weapons.filter((x) => x.cost).map((x) => x.id),
    ...data.srd.armor.filter((x) => x.category !== 'shield' && x.cost).map((x) => x.id),
  ];
}

const kindOf = (data: GameData, id: string) =>
  findItem(data, id)?.kind === 'armor' ? ('armor' as const) : ('weapon' as const);

/** The abilities that fit a weapon or a suit of armor. */
export const abilitiesFor = (data: GameData, id: string): Ability[] =>
  rules(data).abilities.filter((a) => a.targets.includes(kindOf(data, id)));

export function abilityById(data: GameData, id: string): Ability {
  const a = rules(data).abilities.find((x) => x.id === id);
  if (!a) throw new Error(`no ability ${id}`);
  return a;
}

/** Crowns, components, and days for a bonus and an optional ability. */
export function forgeTerms(data: GameData, bonus: number, ability?: string) {
  const tier = tierOf(data, bonus);
  const a = ability ? abilityById(data, ability) : null;
  return {
    crowns: tier.commission + (a?.cost ?? 0),
    components: [...tier.components, ...(a?.components ?? [])],
    days: tier.days + (a?.days ?? 0),
  };
}

/** The roll's difficulty: the bonus's, more with an ability, less a point per flaw taken. */
export function forgeDifficulty(data: GameData, bonus: number, ability?: string, flaws = 0) {
  const base = rules(data).difficulties[bonus - 1] as number;
  return base + (ability ? rules(data).abilityDifficulty : 0) - flaws;
}

export function startForge(
  w: World,
  data: GameData,
  smithId: string,
  item: string,
  bonus: number,
  ability?: string,
  size?: Size,
): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  const m = w.members.find((x) => x.id === smithId && !x.dead);
  if (!m) throw new Error(`no living party member ${smithId}`);
  if (!forgeable(data).includes(item)) throw new Error(`${item} can't be forged`);
  const name = m.character.name;
  if (!canForge(data, m)) return no(`${name} needs Magic 1 and Craft 1 to forge magic.`);
  if (ability && !abilitiesFor(data, item).some((a) => a.id === ability))
    return no(`${abilityById(data, ability).name} doesn't fit that.`);
  if (w.projects.some((p) => p.crafter === m.id)) return no(`${name} is already making something.`);
  const terms = forgeTerms(data, bonus, ability);
  const parts = pickComponents(w, data, terms.components);
  if (!parts)
    return no(`It needs ${terms.components.map((x) => `${x.count} ${x.type}`).join(', ')}.`);
  if (!spend(w, data, terms.crowns))
    return no(`The forging costs ${priceHere(w, data, terms.crowns)} crowns.`);
  removeComponents(w, parts);
  const people = findPeople(data, m.character.people) as People;
  const small = (size ?? fitSize(people)) === 'small' && kindOf(data, item) === 'armor';
  w.projects.push({
    crafter: m.id,
    kind: 'forge',
    item,
    bonus,
    ...(ability ? { ability } : {}),
    ...(small ? { small: true as const } : {}),
    quality: 'normal',
    daysLeft: terms.days,
    days: terms.days,
    town: town.id,
    staying: false,
  });
  note(
    w,
    `${name} starts forging a +${bonus} ${forgedName(data, item, ability)}: ${daysText(terms.days)}.`,
  );
  return { ok: true };
}

export const forgedName = (data: GameData, item: string, ability?: string) =>
  `${(findItem(data, item) as { name: string }).name}${ability ? ` (${abilityById(data, ability).name})` : ''}`;

/** The work is done: the smith rolls; the item goes to their pack, or the forging waits on them. */
export function completeForge(w: World, data: GameData, p: Project, smith: Member): void {
  const bonus = p.bonus as number;
  const flaws = p.flaws ?? [];
  const helper = w.members.some((m) => !m.dead && m !== smith && canForge(data, m));
  const difficulty =
    forgeDifficulty(data, bonus, p.ability, flaws.length) - (helper ? rules(data).assistBonus : 0);
  const check = memberCheck(w, data, smith, rules(data).skill, rules(data).attributes, difficulty);
  const name = forgedName(data, p.item, p.ability);
  const who = smith.character.name;
  if (!check.success) {
    // A smith who stayed behind is free to rejoin and decide.
    w.projects.push({ ...p, failed: true, staying: false, daysLeft: p.days as number });
    note(w, `${who}'s +${bonus} ${name} won't take the binding.`);
    return;
  }
  const entry: InventoryEntry = {
    id: p.item,
    quantity: 1,
    location: 'stowed',
    bonus,
    ...(p.ability ? { ability: p.ability } : {}),
    ...(flaws.length > 0 ? { flaws } : {}),
  };
  const line = sizedLine(data, entry, p.small ? 'small' : 'standard');
  smith.character = { ...smith.character, inventory: [...smith.character.inventory, line] };
  note(w, `${who} forges a +${bonus} ${name}.`);
}

function failedOf(w: World, smithId: string): Project {
  const p = w.projects.find((x) => x.crafter === smithId && x.failed);
  if (!p) throw new Error(`${smithId} has no failed forging`);
  return p;
}

/** Starts a failed forging over: the full price and time again, the components kept. */
export function restartForge(w: World, data: GameData, smithId: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  townHere(w, data);
  const p = failedOf(w, smithId);
  const terms = forgeTerms(data, p.bonus as number, p.ability);
  if (!spend(w, data, terms.crowns))
    return no(`Starting over costs ${priceHere(w, data, terms.crowns)} crowns.`);
  const next: Project = { ...p, daysLeft: terms.days };
  delete next.failed;
  delete next.flaws;
  w.projects = w.projects.map((x) => (x === p ? next : x));
  note(w, `The forging of the ${forgedName(data, p.item, p.ability)} starts over.`);
  return { ok: true };
}

/** The flaws a failed forging could still take: those that fit and it hasn't got. */
export function flawsLeft(data: GameData, p: Project): string[] {
  return rules(data)
    .flaws.filter(
      (f) => f.targets.includes(kindOf(data, p.item)) && !(p.flaws ?? []).includes(f.id),
    )
    .map((f) => f.id);
}

/** Goes on with a flaw: a random one that fits, then half the time again at a cumulative +1. */
export function goOnFlawed(w: World, data: GameData, smithId: string): TownResult {
  const p = failedOf(w, smithId);
  const left = flawsLeft(data, p);
  if (left.length === 0) return no('Another flaw would ruin it; start over or give it up.');
  const flaw = left[w.rng.int(0, left.length - 1)] as string;
  const days = Math.max(0.5, Math.ceil((p.days as number) * rules(data).flawTime * 2) / 2);
  const next: Project = { ...p, flaws: [...(p.flaws ?? []), flaw], daysLeft: days };
  delete next.failed;
  w.projects = w.projects.map((x) => (x === p ? next : x));
  const f = rules(data).flaws.find((x) => x.id === flaw) as { name: string };
  note(w, `The ${forgedName(data, p.item, p.ability)} goes on ${f.name}: ${daysText(days)} more.`);
  return { ok: true };
}
