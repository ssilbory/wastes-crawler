// Making wands, staves, and rods (docs/rules-adaptation.md, Potions, scrolls, and magic devices:
// Devices; vendor/wwn-srd/4.0 Magic and Spellcasting/4.10.0 Creating Magic Items.md): a member
// with Magic and Scribing 1 or better buys the materials in a settlement and works a month, at a
// town's workshop or in camp shifts with crafting tools, like any build. A wand holds one spell
// they know of the first or second level; a staff two or three of them, five spell levels at most.
// Materials cost the device's price for each spell level it holds, or a rod's own price. When the
// work is done they roll Int/Magic against the device's difficulty (a wand's adds its spell's
// level); another member with Magic and Scribing helps for +1. A failed device is lost (Sam's call
// for charged items; a rod fails the same way). A wand or staff holds its maker's caster level and
// rolls its charges when finished.
import type { Device, Project } from '../../data/schemas/index.ts';
import { roll } from '../../rules/dice.ts';
import type { GameData } from '../character/context.ts';
import { tenths } from '../character/items.ts';
import { heldSpell } from '../character/spell-items.ts';
import { putLine } from '../character/stacks.ts';
import { casterLevelOf } from '../combat/combatants.ts';
import { memberCheck, note } from './members.ts';
import { scribable } from './scribing.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { Member, World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });
const rules = (data: GameData) => data.content.devices;

export function deviceOf(data: GameData, id: string): Device {
  const d = rules(data).devices.find((x) => x.id === id);
  if (!d) throw new Error(`no device ${id}`);
  return d;
}

/** SRD 4.10.0's Int/Magic, here with Scribing 1 or better besides. */
export const canEnchant = (data: GameData, m: Member) =>
  Object.hasOwn(m.character.skills, rules(data).skill) &&
  (m.character.skills[data.content.scrolls.skill] ?? -1) >= rules(data).scribing;

const levels = (data: GameData, spells: readonly string[]) =>
  spells.reduce((n, id) => n + heldSpell(data, id).level, 0);

/** Why these spells don't fit the device, or null if they do; any member may know them. */
export function spellsMisfit(data: GameData, d: Device, spells: readonly string[]): string | null {
  const dev = d.device;
  if (dev.kind === 'rod') return spells.length === 0 ? null : `A ${d.name} holds no spells.`;
  const fits = new Set(scribable(data).map((s) => s.id));
  if (!spells.every((id) => fits.has(id)))
    return 'Only spells cast at a foe or friend in a fight fit.';
  if (new Set(spells).size !== spells.length) return 'Each spell goes in once.';
  if (dev.kind === 'wand') {
    if (spells.length !== 1) return 'A wand holds one spell.';
    return levels(data, spells) <= dev.maxSpellLevel
      ? null
      : `A wand holds a spell of level ${dev.maxSpellLevel} or less.`;
  }
  if (spells.length < dev.minSpells || spells.length > dev.maxSpells)
    return `A staff holds ${dev.minSpells} to ${dev.maxSpells} spells.`;
  return levels(data, spells) <= dev.maxLevels
    ? null
    : `A staff's spells come to ${dev.maxLevels} levels at most.`;
}

/** Listed crowns the materials cost. */
export function deviceListed(data: GameData, id: string, spells: readonly string[]): number {
  const d = deviceOf(data, id);
  const each = tenths(d.cost) / 10;
  return d.device.kind === 'rod' ? each : each * levels(data, spells);
}

export function deviceDifficulty(data: GameData, id: string, spells: readonly string[]): number {
  const d = deviceOf(data, id);
  return d.difficulty + (d.device.kind === 'wand' ? levels(data, spells) : 0);
}

export function startDevice(
  w: World,
  data: GameData,
  makerId: string,
  id: string,
  spells: readonly string[],
): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  const m = w.members.find((x) => x.id === makerId && !x.dead);
  if (!m) throw new Error(`no living party member ${makerId}`);
  const d = deviceOf(data, id);
  const name = m.character.name;
  if (!canEnchant(data, m)) return no(`${name} needs Magic and Scribing 1 to make devices.`);
  const misfit = spellsMisfit(data, d, spells);
  if (misfit) return no(misfit);
  const unknown = spells.find((s) => !m.character.spells.known.includes(s));
  if (unknown) return no(`${name} doesn't know ${heldSpell(data, unknown).name}.`);
  if (w.projects.some((p) => p.crafter === m.id)) return no(`${name} is already making something.`);
  const listed = deviceListed(data, id, spells);
  if (!spend(w, data, listed))
    return no(`The materials cost ${priceHere(w, data, listed)} crowns.`);
  const days = rules(data).days;
  w.projects.push({
    crafter: m.id,
    kind: 'device',
    item: id,
    ...(spells.length > 0 ? { spells: [...spells] } : {}),
    quality: 'normal',
    daysLeft: days,
    town: town.id,
    staying: false,
  });
  note(w, `${name} starts on a ${d.name}: ${daysText(days)} of work.`);
  return { ok: true };
}

/** A finished device's inventory line: a wand or staff with its spells, level, and charges. */
export function deviceLine(
  w: World,
  d: Device,
  spells: readonly string[],
  casterLevel: number,
): Parameters<typeof putLine>[1] {
  const line = { id: d.id, quantity: 1, location: 'stowed' as const };
  if (d.device.kind === 'rod') return line;
  const charges = Math.max(1, roll(w.rng, d.device.charges).total);
  return { ...line, spells: [...spells], casterLevel, charges };
}

/** The work is done: the maker rolls, and the device goes to their pack or is lost. */
export function completeDevice(w: World, data: GameData, p: Project, maker: Member): void {
  const d = deviceOf(data, p.item);
  const spells = p.spells ?? [];
  const helper = w.members.some((m) => !m.dead && m !== maker && canEnchant(data, m));
  const difficulty = deviceDifficulty(data, d.id, spells) - (helper ? rules(data).assistBonus : 0);
  const check = memberCheck(w, data, maker, rules(data).skill, rules(data).attributes, difficulty);
  const who = maker.character.name;
  if (!check.success) {
    note(w, `${who}'s ${d.name} cracks as the binding fails; the materials are lost.`);
    return;
  }
  const level = Math.max(1, casterLevelOf(data, maker.character));
  const inventory = putLine(maker.character.inventory, deviceLine(w, d, spells, level));
  maker.character = { ...maker.character, inventory };
  note(w, `${who} finishes a ${d.name}.`);
}
