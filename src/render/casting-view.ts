// What a caster's day of spells looks like on the sheet and in the builder: slots, the Invoker's
// spell points (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.11 The Invoker.md), or
// a Blood Priest's miracles alone.
import type { CastingLevelRow } from '../rules/progression.ts';

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** "Casts 1 a day, prepares 3, up to level 1.", or with spell points, or "Miracles only." */
export function castingText(s: CastingLevelRow, points: boolean): string {
  if (s.maxSpellLevel === 0) return 'Miracles only.';
  const pay = [
    s.spellsCast > 0 && `casts ${s.spellsCast} a day`,
    points && `has ${plural(s.spellPoints, 'spell point')} a day`,
  ].filter(Boolean);
  const text = `${pay.join(' and ')}, prepares ${s.spellsPrepared}, up to level ${s.maxSpellLevel}.`;
  return text.charAt(0).toUpperCase() + text.slice(1);
}
