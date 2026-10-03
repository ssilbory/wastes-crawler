import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';

const contentBase = {
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
};

/** A playable people; see the Peoples rules in docs/rules-adaptation.md. */
export const PeopleSchema = z.strictObject({
  ...contentBase,
  /** Added to generated scores; the result stays within 3–18. */
  attributeModifiers: z.partialRecord(AttributeSchema, z.int().min(-4).max(4)),
  size: z.enum(['small', 'standard', 'large']),
});
export type People = z.infer<typeof PeopleSchema>;

export const AttributePoolSchema = z.enum(['any', 'physical', 'mental']);
export type AttributePool = z.infer<typeof AttributePoolSchema>;

/** Background table entries, in the SRD 1.3 format. */
export const LearningEntrySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('skill'), skill: IdSchema }),
  /** Stab, Shoot, or Punch, chosen by the player. */
  z.strictObject({ kind: z.literal('any-combat') }),
]);
export type LearningEntry = z.infer<typeof LearningEntrySchema>;

export const GrowthEntrySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('skill'), skill: IdSchema }),
  z.strictObject({ kind: z.literal('any-combat') }),
  /** Any non-magical skill, chosen by the player. */
  z.strictObject({ kind: z.literal('any-skill') }),
  /** +2 may be split between two attributes of the pool. */
  z.strictObject({
    kind: z.literal('attribute'),
    amount: z.union([z.literal(1), z.literal(2)]),
    pool: AttributePoolSchema,
  }),
]);
export type GrowthEntry = z.infer<typeof GrowthEntrySchema>;

export const BackgroundSchema = z.strictObject({
  ...contentBase,
  freeSkill: IdSchema,
  /** Rolled on a d6. */
  growth: z.array(GrowthEntrySchema).length(6),
  /** Rolled on a d8, or picked twice. */
  learning: z.array(LearningEntrySchema).length(8),
});
export type Background = z.infer<typeof BackgroundSchema>;

export const ContentSchemas = {
  peoples: z.array(PeopleSchema).min(1),
  backgrounds: z.array(BackgroundSchema).min(1),
} as const;
export type ContentData = {
  [K in keyof typeof ContentSchemas]: z.infer<(typeof ContentSchemas)[K]>;
};
