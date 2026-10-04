import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';

/** A magical tradition (SRD 1.5.10 High Mage, 1.5.7 Elementalist). Arts use the same ids. */
export const TraditionSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** Granted as a creation skill pick when the class is taken. */
  bonusSkill: IdSchema,
  /** Spell traditions the caster can learn from. */
  spellLists: z.array(z.enum(['high-magic', 'elementalist'])).min(1),
  /** Effort maximum: 1 + best skill + best attribute modifier, one lower for partial casters. */
  effort: z.strictObject({
    skills: z.array(IdSchema).min(1),
    attributes: z.array(AttributeSchema).min(1),
  }),
});
export type Tradition = z.infer<typeof TraditionSchema>;

/**
 * A class a new character may take: a progression id, plus how a Mage's traditions, arts tables,
 * and spell slots fit together. Partial traditions pair with the progression's other half.
 */
export const ClassOptionSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** Class abilities that matter to the engine: the full Warrior's (SRD 1.5.18), and the Expert's
   * Quick Learner (1.5.8), which partial Experts share (1.5.1). */
  abilities: z.array(z.enum(['killing-blow', 'veterans-luck', 'quick-learner'])).optional(),
  mage: z
    .strictObject({
      traditions: z
        .array(
          z.strictObject({
            tradition: IdSchema,
            partial: z.boolean(),
            /** The casting table whose Arts Gained column this tradition uses. */
            arts: IdSchema,
          }),
        )
        .min(1)
        .max(2),
      /** The casting table for spells cast and prepared. */
      slots: IdSchema,
      /** SRD 1.7.5: four first-level spells for full or dual casters, two for partial. */
      startingSpells: z.int().min(1),
      /** SRD 2.7.1.7: two for High Mages, one for other Mages. */
      spellsPerLevel: z.int().min(1),
    })
    .optional(),
});
export type ClassOption = z.infer<typeof ClassOptionSchema>;
