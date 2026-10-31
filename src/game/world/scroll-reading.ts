// Reading a scroll of a spell cast outside fights (docs/rules-adaptation.md, Scrolls outside fights
// in Phase 21; vendor/wwn-srd/4.0 Magic and Spellcasting/4.9.0 Magic Items and Enchanted
// Treasures.md, 4.9.1). Any member carrying one reads it with the same Magic check as in a fight;
// outside a fight a failure fizzles. Either way the scroll is used up. Read well, the spell is the
// reader's to cast until it is cast or the quarter ends, at the scroll's caster level (casting.ts).
import type { GameData } from '../character/context.ts';
import { heldSpell } from '../character/spell-items.ts';
import { takeLine } from '../character/stacks.ts';
import { memberCheck, note } from './members.ts';
import type { TownResult } from './services.ts';
import type { Member, World } from './types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

/** The scrolls a member carries of spells cast outside fights, by inventory line. */
export function outsideScrolls(data: GameData, m: Member): { item: number; spell: string }[] {
  const outside = new Set(data.content.spellRules.outsideCombat);
  const scroll = data.content.scrolls.scroll.id;
  return m.character.inventory.flatMap((e, item) =>
    e.id === scroll && e.spell && outside.has(e.spell) ? [{ item, spell: e.spell }] : [],
  );
}

/** Reads the scroll on inventory line `item`: the spell is held, or it fizzles. */
export function unrollScroll(w: World, data: GameData, memberId: string, item: number): TownResult {
  if (w.encounter) return no('Settle the encounter first.');
  const m = w.members.find((x) => x.id === memberId);
  if (!m || m.dead || m.character.hp.current <= 0) return no('No one is able to read that.');
  const held = outsideScrolls(data, m).find((x) => x.item === item);
  if (!held) return no('That is no scroll of a spell cast outside a fight.');
  if (m.unrolled) return no(`${m.character.name} already holds a spell read from a scroll.`);
  const line = m.character.inventory[item] as Member['character']['inventory'][number];
  const spell = heldSpell(data, held.spell);
  const { rest } = takeLine(m.character.inventory, item, 1);
  m.character = { ...m.character, inventory: rest };
  const name = m.character.name;
  note(w, `${name} reads a scroll of ${spell.name}.`);
  const read = data.content.scrolls.read;
  const magic = m.character.skills[read.skill] ?? -1;
  // Safe with Magic at least the spell level less 1; otherwise a check, and outside a fight a
  // miss of any size fizzles.
  if (
    magic < spell.level - 1 &&
    !memberCheck(w, data, m, read.skill, read.attributes, read.difficulty + spell.level).success
  ) {
    note(w, 'The spell fizzles.');
    return { ok: true };
  }
  m.unrolled = { spell: spell.id, level: line.casterLevel as number };
  note(w, `${spell.name} is ${name}'s to cast until the quarter ends.`);
  return { ok: true };
}
