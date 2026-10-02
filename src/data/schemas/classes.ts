import { z } from 'zod';
import { DiceSchema, IdSchema, SourceSchema, recordBase } from './common.ts';

export const ClassSchema = z.object({
  ...recordBase,
  description: z.string().min(1),
  /** Class abilities and benefits, verbatim, in SRD order. */
  abilities: z.array(z.object({ name: z.string().min(1), text: z.string().min(1) })),
});
export type ClassRecord = z.infer<typeof ClassSchema>;

export const FocusPickSchema = z.object({
  count: z.int().min(1),
  category: z.enum(['any', 'warrior', 'expert']),
});

/** A level table for one full class or partial-class combination. */
export const ProgressionSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  /** Every SRD table this progression appears in; duplicates must agree. */
  sources: z.array(SourceSchema).min(1),
  levels: z
    .array(
      z.object({
        level: z.int().min(1).max(10),
        hitDice: DiceSchema,
        attackBonus: z.int().min(0),
        focusPicks: z.array(FocusPickSchema),
      }),
    )
    .length(10),
});
export type Progression = z.infer<typeof ProgressionSchema>;

export const CastingProgressionSchema = z.object({
  id: IdSchema,
  name: z.string().min(1),
  sources: z.array(SourceSchema).min(1),
  levels: z
    .array(
      z.object({
        level: z.int().min(1).max(10),
        maxSpellLevel: z.int().min(1).max(5),
        spellsCast: z.int().min(1),
        spellsPrepared: z.int().min(1),
        /** Named art ids gained at this level. */
        arts: z.array(IdSchema),
        /** Free picks from the tradition's other arts. */
        anyArts: z.int().min(0),
      }),
    )
    .length(10),
});
export type CastingProgression = z.infer<typeof CastingProgressionSchema>;
