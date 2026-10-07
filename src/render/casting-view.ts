// What a caster's day of spells looks like on the sheet and in the builder: slots, the Invoker's
// spell points (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.11 The Invoker.md), or
// a Blood Priest's miracles alone.
import type { SheetMagic } from '../game/character/derived.ts';
import type { CastingLevelRow } from '../rules/progression.ts';
import type { SpellPool } from '../rules/spell-points.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/**
 * "Casts 1 a day, prepares 3, up to level 1.", or with spell points, or with no spells "Miracles
 * only." for a Blood Priest and "Arts only." for others.
 */
export function castingText(s: CastingLevelRow, points: boolean, miracles = false): string {
  if (s.maxSpellLevel === 0) return miracles ? 'Miracles only.' : 'Arts only.';
  const pay = [
    s.spellsCast > 0 && `casts ${s.spellsCast} a day`,
    points && `has ${plural(s.spellPoints, 'spell point')} a day`,
  ]
    .filter(Boolean)
    .join(' and ');
  const text = `${pay ? `${pay}, ` : ''}prepares ${s.spellsPrepared}, up to level ${s.maxSpellLevel}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}

/** "3 spells left today", with an Invoker's points: "1 spell and 2 spell points left today". */
export function castsLeftText(pool: SpellPool, magic: SheetMagic): string {
  const left = [
    (magic.slots.spellsCast > 0 || !magic.points) && plural(pool.spellsLeft, 'spell'),
    magic.points && plural(pool.pointsLeft, 'spell point'),
  ].filter(Boolean);
  return `${left.join(' and ')} left today`;
}
