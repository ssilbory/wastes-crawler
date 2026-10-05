// Casting a spell outside a fight (vendor/wwn-srd/4.0 Magic and Spellcasting/4.2.0 Preparing and
// Casting Spells.md): a prepared spell of a castable level, out of armor, with a slot left today.
import { gameSpells, type GameSpell } from '../../data/spells.ts';
import type { GameData } from '../character/context.ts';
import { characterSheet } from '../character/derived.ts';
import type { Member } from './types.ts';

/** Why the member can't cast the spell now, or null if they can. */
export function cannotCast(data: GameData, m: Member | undefined, spell: string): string | null {
  if (!m || m.dead || m.character.hp.current <= 0) return 'No one is able to cast that.';
  const magic = characterSheet(m.character, data).magic;
  const name = m.character.name;
  const s = gameSpells(data.srd, data.content).find((x) => x.id === spell) as GameSpell;
  if (!magic || !m.character.spells.prepared.includes(spell))
    return `${name} hasn't prepared ${s.name}.`;
  // 4.2.0: only spells of a level the caster can cast.
  if (s.level > magic.slots.maxSpellLevel) return `${name} can't cast level-${s.level} spells yet.`;
  if (!magic.canCast) return `${name} can't cast in armor or with a shield.`;
  if (m.spellsCast >= magic.slots.spellsCast) return `${name} has no spells left today.`;
  return null;
}
