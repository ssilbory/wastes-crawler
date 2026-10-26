// God Wills It (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.5 The Blood Priest.md):
// up to six allies per character level in earshot gain a bonus to hit, damage, and Shock.
import { isUp } from './targeting.ts';
import type { Battle, Combatant } from './types.ts';

const BLESSED_PER_LEVEL = 6;

/** Blesses the caster's side, the PCs first; blessings don't add up, each keeps the best. */
export function bless(b: Battle, caster: Combatant, bonus: number, level: number): void {
  const allies = b.combatants
    .filter((x) => x.side === caster.side && isUp(x))
    .sort((x, y) => Number(x.kind !== 'pc') - Number(y.kind !== 'pc'))
    .slice(0, BLESSED_PER_LEVEL * level);
  for (const x of allies) x.blessed = Math.max(x.blessed, bonus);
}
