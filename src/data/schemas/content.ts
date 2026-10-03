import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';

const contentBase = {
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
};

const Modifiers = z.partialRecord(AttributeSchema, z.int().min(-4).max(4));

/** A people's sub-type, such as a centaur's animal half; its modifiers add to the people's. */
export const LineageSchema = z.strictObject({
  ...contentBase,
  attributeModifiers: Modifiers,
});
export type Lineage = z.infer<typeof LineageSchema>;

/** A playable people; see the Peoples rules in docs/rules-adaptation.md. */
export const PeopleSchema = z.strictObject({
  ...contentBase,
  /** Added to generated scores; the result stays within 3–18. */
  attributeModifiers: Modifiers,
  size: z.enum(['small', 'standard', 'large']),
  /** When present, every member must belong to one lineage. */
  lineages: z.array(LineageSchema).min(2).optional(),
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
  /** The peoples who may take this background; absent means every people. */
  peoples: z.array(IdSchema).min(1).optional(),
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
