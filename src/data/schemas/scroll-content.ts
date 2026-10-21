import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';
import { GearSchema } from './gear.ts';

const Percent = z.int().min(0).max(100);

/**
 * Scrolls (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Scrolls; vendor/wwn-srd/
 * 4.0 Magic and Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.1): the scroll
 * item, writing one with Scribing, and reading one with Magic.
 */
export const ScrollContentSchema = z.strictObject({
  /** The skill a scroll is written with and rolled with, and its attributes. */
  skill: IdSchema,
  attributes: z.array(AttributeSchema).min(1),
  /** The scroll: its cost is the writing cost for each level of the spell it holds. */
  scroll: GearSchema,
  /** SRD 4.9.1: a week to inscribe. */
  days: z.int().min(1),
  /** SRD 4.9.1: the writing difficulty is this plus half the spell level, rounded up. */
  difficulty: z.int().min(2),
  /** SRD 4.10.0: an apprentice adds this to the check; here, another party member with the skill. */
  assistBonus: z.int().min(0),
  /** Reading one with too little Magic: the skill, attributes, and base difficulty plus level. */
  read: z.strictObject({
    skill: IdSchema,
    attributes: z.array(AttributeSchema).min(1),
    difficulty: z.int().min(2),
    /** Missing by this much or less, the spell fizzles; by more, it strikes a random target. */
    fizzle: z.int().min(0),
  }),
  /** The percent of potion drops that are scrolls instead. */
  dropShare: Percent,
});
export type ScrollContent = z.infer<typeof ScrollContentSchema>;
