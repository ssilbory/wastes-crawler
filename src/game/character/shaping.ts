// Modifier bonuses on a character: Developed Attribute (1.6.0 Foci.md) and a Necromancer's
// Boneshaper (vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0 Necromancer Spells.md).
import type { Character } from '../../data/schemas/index.ts';
import type { ModifierBonuses } from '../../rules/attributes.ts';
import { modifierBonuses } from './foci.ts';

/** Focus bonuses with any Boneshaper changes added. */
export function characterBonuses(c: Pick<Character, 'foci' | 'shaped'>): ModifierBonuses {
  const out = modifierBonuses(c.foci);
  for (const [a, n] of Object.entries(c.shaped?.changes ?? {}) as [keyof ModifierBonuses, number][])
    out[a] = (out[a] ?? 0) + n;
  return out;
}
