// Writing scrolls (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Scrolls;
// vendor/wwn-srd/4.0 Magic and Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.1):
// a member with Scribing writes one of the spells they know into a scroll over a week, at 20 crowns
// a spell level, in a town's workshop or in camp shifts with crafting tools, like any build. When
// the work is done they roll Int/Scribing against 7 plus half the spell level, rounded up; another
// member with Scribing helps, as the SRD's apprentice (4.10.0), for +1. A failed scroll is lost.
// The scroll goes off at the scribe's caster level. Only spells the combat engine can cast at a
// target fit on a scroll for now.
import type { Project } from '../../data/schemas/index.ts';
import { gameSpells, type GameSpell } from '../../data/spells.ts';
import type { GameData } from '../character/context.ts';
import { tenths } from '../character/items.ts';
import { putLine } from '../character/stacks.ts';
import { casterLevelOf } from '../combat/combatants.ts';
import { memberCheck, note } from './members.ts';
import type { TownResult } from './services.ts';
import { priceHere, spend, townHere } from './town.ts';
import type { Member, World } from './types.ts';
import { daysText } from './wording.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });
const rules = (data: GameData) => data.content.scrolls;

/** Spells that fit on a scroll: those cast at a target or row in a fight, Smite aside. */
export function scribable(data: GameData): GameSpell[] {
  const ids = new Set(
    data.content.combatMagic
      .filter((m) => m.source === 'spell' && m.target !== 'none')
      .map((m) => m.id),
  );
  return gameSpells(data.srd, data.content).filter((s) => ids.has(s.id));
}

const spellOf = (data: GameData, id: string): GameSpell => {
  const s = scribable(data).find((x) => x.id === id);
  if (!s) throw new Error(`${id} can't go on a scroll`);
  return s;
};

export const canScribe = (data: GameData, m: Member) =>
  Object.hasOwn(m.character.skills, rules(data).skill);

/** The spells a member could write: scribable ones in their grimoire. */
export const scribesOf = (data: GameData, m: Member): GameSpell[] =>
  canScribe(data, m) ? scribable(data).filter((s) => m.character.spells.known.includes(s.id)) : [];

/** Listed crowns a scroll costs to write: the scroll's price for each level of the spell. */
export const scrollListed = (data: GameData, spell: string) =>
  (tenths(rules(data).scroll.cost) / 10) * spellOf(data, spell).level;

export const scribeDifficulty = (data: GameData, spell: string) =>
  rules(data).difficulty + Math.ceil(spellOf(data, spell).level / 2);

export function startScroll(w: World, data: GameData, scribeId: string, spell: string): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const town = townHere(w, data);
  const m = w.members.find((x) => x.id === scribeId && !x.dead);
  if (!m) throw new Error(`no living party member ${scribeId}`);
  const s = spellOf(data, spell);
  const name = m.character.name;
  if (!canScribe(data, m)) return no(`${name} has no Scribing skill.`);
  if (!m.character.spells.known.includes(spell)) return no(`${name} doesn't know ${s.name}.`);
  if (w.projects.some((p) => p.crafter === m.id)) return no(`${name} is already making something.`);
  const listed = scrollListed(data, spell);
  if (!spend(w, data, listed)) return no(`The inks cost ${priceHere(w, data, listed)} crowns.`);
  const days = rules(data).days;
  w.projects.push({
    crafter: m.id,
    kind: 'scribe',
    item: rules(data).scroll.id,
    spell,
    quality: 'normal',
    daysLeft: days,
    town: town.id,
    staying: false,
  });
  note(w, `${name} starts a scroll of ${s.name}: ${daysText(days)} of work.`);
  return { ok: true };
}

/** The work is done: the scribe rolls, and the scroll goes to their pack or is lost. */
export function completeScroll(w: World, data: GameData, p: Project, scribe: Member): void {
  // startScroll always names the spell.
  const spell = spellOf(data, p.spell as string);
  const helper = w.members.some((m) => !m.dead && m !== scribe && canScribe(data, m));
  const difficulty = scribeDifficulty(data, spell.id) - (helper ? rules(data).assistBonus : 0);
  const check = memberCheck(w, data, scribe, rules(data).skill, rules(data).attributes, difficulty);
  const who = scribe.character.name;
  if (!check.success) {
    note(w, `${who}'s scroll of ${spell.name} blots and burns; the inks are lost.`);
    return;
  }
  const inventory = putLine(scribe.character.inventory, {
    id: rules(data).scroll.id,
    quantity: 1,
    location: 'stowed',
    spell: spell.id,
    casterLevel: Math.max(1, casterLevelOf(data, scribe.character)),
  });
  scribe.character = { ...scribe.character, inventory };
  note(w, `${who} finishes a scroll of ${spell.name}.`);
}
