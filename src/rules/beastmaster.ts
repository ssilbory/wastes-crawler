// The Beastmaster's numbers (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.4 The
// Beastmaster.md): the companions it may bind and what its arts do to them and to itself.
import { innateArmorClass } from './armor-class.ts';

/** A companion can't have more hit dice than the Beastmaster's level plus one. */
export const maxCompanionHitDice = (level: number): number => level + 1;

/** Feral Toughness: a base AC of 13 plus half the level, rounded up. */
export const feralAc = (level: number): number => innateArmorClass(13, level);

/** Natural Weaponry: +1 damage and Shock at level 3, +2 at 6, +3 at 9. */
export const weaponryBonus = (level: number): number => Math.min(3, Math.floor(level / 3));

/** Shared Vitality: the companion's hit dice are no lower than the Beastmaster's level. */
export const sharedHitDice = (natural: number, level: number): number => Math.max(natural, level);

/** Shared Vitality: a companion's hit bonus is at least half its hit dice, rounded up. */
export const sharedHitFloor = (hitDice: number): number => Math.ceil(hitDice / 2);

/** Swift Healing: 1d6 per character level. */
export const swiftHealingDice = (level: number) => ({
  count: Math.max(1, level),
  sides: 6,
  modifier: 0,
});
