import { z } from 'zod';
import { DiceSchema, IdSchema, SourceSchema, recordBase } from './common.ts';

export const ClassSchema = z.strictObject({
  ...recordBase,
  description: z.string().min(1),
  /** Class abilities and benefits, verbatim, in SRD order. */
  abilities: z.array(z.strictObject({ name: z.string().min(1), text: z.string().min(1) })),
});
export type ClassRecord = z.infer<typeof ClassSchema>;

export const FocusPickSchema = z.strictObject({
  count: z.int().min(1),
  category: z.enum(['any', 'warrior', 'expert']),
});
export type FocusPick = z.infer<typeof FocusPickSchema>;

/** A level table for one full class or partial-class combination. */
export const ProgressionSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** Every SRD table this progression appears in; duplicates must agree. */
  sources: z.array(SourceSchema).min(1),
  levels: z
    .array(
      z.strictObject({
        level: z.int().min(1).max(10),
        hitDice: DiceSchema,
        attackBonus: z.int().min(0),
        focusPicks: z.array(FocusPickSchema),
      }),
    )
    .length(10),
});
export type Progression = z.infer<typeof ProgressionSchema>;

export const CastingProgressionSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  sources: z.array(SourceSchema).min(1),
  /** Spell points and spells prepared both add the Int modifier (the Invoker, 1.5.11). */
  plusInt: z.literal(true).optional(),
  levels: z
    .array(
      z.strictObject({
        level: z.int().min(1).max(10),
        /** All 0 for a tradition of arts alone (the Blood Priest, 1.5.5). */
        maxSpellLevel: z.int().min(0).max(5),
        spellsCast: z.int().min(0),
        /** A daily pool spent by spell level in place of spells cast (the Invoker, 1.5.11). */
        spellPoints: z.int().min(0).optional(),
        /** The hit bonus in a non-humanoid alternate form (the Skinshifter, 1.5.15). */
        formBonus: z.int().min(0).optional(),
        spellsPrepared: z.int().min(0),
        /** Named art ids gained at this level. */
        arts: z.array(IdSchema),
        /** Free picks from the tradition's other arts. */
        anyArts: z.int().min(0),
      }),
    )
    .length(10),
});
export type CastingProgression = z.infer<typeof CastingProgressionSchema>;
