// A Skinshifter's alternate forms (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.15
// The Skinshifter.md): the numbers its form arts change.

/** Feral Prowess and Sculptor's Beauty: +1 to a modifier, to a maximum of +2. */
export const formModifier = (modifier: number): number => (modifier >= 2 ? modifier : modifier + 1);

/** Savage Talons: +1 damage and Shock at level 3, +2 at 6, +3 at 9. */
export const talonsBonus = (level: number): number => Math.min(3, Math.floor(level / 3));

/** Intrinsic Armor: a base AC of 14 plus half the character level, rounded down. */
export const intrinsicAc = (level: number): number => 14 + Math.floor(level / 2);

/** Pliant Flesh: a shift paid with Effort heals 1d6 plus the level. */
export const pliantHeal = (roll: number, level: number): number => roll + level;

/**
 * Hit points after a shift that changes the Con modifier by `conChange` at `level`: Feral Prowess's
 * hit points come and go with the form, and losing them never fells the conscious (Sam's call). The
 * maximum never drops below 1, even if the level changed between shifting in and out.
 */
export function shiftedHp(
  hp: { max: number; current: number },
  level: number,
  conChange: number,
): { max: number; current: number } {
  const change = level * conChange;
  const max = Math.max(1, hp.max + change);
  const floor = hp.current > 0 ? 1 : 0;
  return { max, current: Math.min(max, Math.max(floor, hp.current + change)) };
}
