// Casting a spell outside a fight (vendor/wwn-srd/4.0 Magic and Spellcasting/4.2.0 Preparing and
// Casting Spells.md): a prepared spell of a castable level, out of armor, with a slot left today,
// or an Invoker's spell points for it (docs/rules-adaptation.md, Spell points).
import { gameSpells, type GameSpell } from '../../data/spells.ts';
import { canPay, payFor, type SpellPool } from '../../rules/spell-points.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet, type SheetMagic } from '../character/derived.ts';
import type { Member } from './types.ts';

const spellOf = (data: GameData, id: string) =>
  gameSpells(data.srd, data.content).find((x) => x.id === id) as GameSpell;

/** What the member has left to cast with today. */
export const poolOf = (m: Member, magic: SheetMagic): SpellPool => ({
  spellsLeft: Math.max(0, magic.slots.spellsCast - m.spellsCast),
  pointsLeft: Math.max(0, magic.slots.spellPoints - m.pointsSpent),
});

/** Why the member can't cast the spell now, or null if they can. */
export function cannotCast(data: GameData, m: Member | undefined, spell: string): string | null {
  if (!m || m.dead || m.character.hp.current <= 0) return 'No one is able to cast that.';
  const magic = characterSheet(m.character, data).magic;
  const name = m.character.name;
  const s = spellOf(data, spell);
  if (!magic || !m.character.spells.prepared.includes(spell))
    return `${name} hasn't prepared ${s.name}.`;
  // 4.2.0: only spells of a level the caster can cast.
  if (s.level > magic.slots.maxSpellLevel) return `${name} can't cast level-${s.level} spells yet.`;
  if (!magic.canCast) return `${name} can't cast in armor or with a shield.`;
  if (!canPay(poolOf(m, magic), s.level)) return `${name} has no spells left today.`;
  return null;
}

/** Pays for a spell cannotCast allowed: a slot while any are left, else its level in points. */
export function spendCast(data: GameData, m: Member, spell: string): void {
  const magic = characterSheet(m.character, data).magic as SheetMagic;
  const pool = payFor(poolOf(m, magic), spellOf(data, spell).level);
  m.spellsCast = magic.slots.spellsCast - pool.spellsLeft;
  m.pointsSpent = magic.slots.spellPoints - pool.pointsLeft;
}
