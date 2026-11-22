import { z } from 'zod';

/**
 * Hardcore options (docs/rules-adaptation.md, Hardcore options; Sam's calls): each one is off by
 * default, kept in the world save, and can be switched on or off at any time.
 */
export const HardcoreSchema = z.strictObject({
  /** No casting a spell without a slot by taking System Strain. */
  noStrainCasting: z.boolean(),
  /** A PC at zero hit points dies, unless a focus or art that saves them at zero does. */
  deathAtZero: z.boolean(),
  /** Days of crafting earn no XP. */
  noCraftingXp: z.boolean(),
  /** Quests pay no XP. */
  noQuestXp: z.boolean(),
  /**
   * PC healer-class healing is harsher: Purge Ailment adds strain, healing that revives the downed
   * adds one more, and after a fight each ally takes one healing at most.
   */
  harshHealing: z.boolean(),
  /** Healing Touch and Merciful Healing cost the healer 1 System Strain too. */
  healerStrain: z.boolean(),
});
export type Hardcore = z.infer<typeof HardcoreSchema>;
export type HardcoreOption = keyof Hardcore;

/** Every hardcore option off: the game as the rest of docs/rules-adaptation.md has it. */
export const NO_HARDCORE: Hardcore = {
  noStrainCasting: false,
  deathAtZero: false,
  noCraftingXp: false,
  noQuestXp: false,
  harshHealing: false,
  healerStrain: false,
};
