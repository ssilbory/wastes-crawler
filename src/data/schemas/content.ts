import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';
import {
  EquipmentRulesSchema,
  FocusEffectSchema,
  ShieldSchema,
  StartingPackageSchema,
} from './equipment-content.ts';
import { ClassOptionSchema, TraditionSchema } from './magic-content.ts';

const contentBase = {
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
};

const Modifiers = z.partialRecord(AttributeSchema, z.int().min(-4).max(4));

/** What a focus grants as a bonus skill the first time it is taken (SRD 1.2.2, 2.7.1.6). */
export const BonusSkillSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('skill'), skill: IdSchema }),
  z.strictObject({ kind: z.literal('one-of'), skills: z.array(IdSchema).min(2) }),
  z.strictObject({ kind: z.literal('any-combat') }),
  z.strictObject({ kind: z.literal('any') }),
  z.strictObject({ kind: z.literal('any-except'), except: z.array(IdSchema).min(1) }),
]);
export type BonusSkill = z.infer<typeof BonusSkillSchema>;

/** Which class focus picks may take a focus; see the Foci rules in docs/rules-adaptation.md. */
export const FocusCategorySchema = z.enum(['combat', 'non-combat', 'both']);
export type FocusCategory = z.infer<typeof FocusCategorySchema>;

/**
 * How the game uses an SRD focus. `later` foci wait for the systems they need; `excluded` ones
 * don't fit the setting. `attributeChoice` marks Developed Attribute; `dieHard` marks the extra
 * hit points of Die Hard.
 */
export const FocusRuleSchema = z.strictObject({
  id: IdSchema,
  availability: z.enum(['pickable', 'later', 'excluded']),
  category: FocusCategorySchema,
  bonusSkill: BonusSkillSchema.optional(),
  attributeChoice: z.literal(true).optional(),
  dieHard: z.literal(true).optional(),
  /** Only characters with a spellcasting class may take it. */
  requiresCaster: z.literal(true).optional(),
  effects: z.array(FocusEffectSchema).optional(),
});
export type FocusRule = z.infer<typeof FocusRuleSchema>;

/** A people's signature focus, authored in the SRD focus format. */
export const RacialFocusSchema = z.strictObject({
  ...contentBase,
  levels: z
    .array(z.strictObject({ level: z.int().min(1).max(2), text: z.string().min(1) }))
    .min(1)
    .max(2),
  bonusSkill: BonusSkillSchema.optional(),
  effects: z.array(FocusEffectSchema).optional(),
});
export type RacialFocus = z.infer<typeof RacialFocusSchema>;

/** A people's sub-type, such as a centaur's animal half; its modifiers add to the people's. */
export const LineageSchema = z.strictObject({
  ...contentBase,
  attributeModifiers: Modifiers,
  /** Added to the people's signature foci. */
  signatureFoci: z.array(IdSchema),
});
export type Lineage = z.infer<typeof LineageSchema>;

/** A playable people; see the Peoples rules in docs/rules-adaptation.md. */
export const PeopleSchema = z.strictObject({
  ...contentBase,
  /** Added to generated scores; the result stays within 3–18. */
  attributeModifiers: Modifiers,
  size: z.enum(['small', 'standard', 'large']),
  /** Racial foci every member gets for free (ids in racial-foci.json). */
  signatureFoci: z.array(IdSchema),
  /** SRD foci that fill the remaining racial focus slots, up to three in all. */
  racialFocusPicks: z.array(IdSchema),
  /** Wears barding in a second armor slot (docs/rules-adaptation.md, Centaur barding). */
  barding: z.literal(true).optional(),
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
  racialFoci: z.array(RacialFocusSchema).min(1),
  focusRules: z.array(FocusRuleSchema).min(1),
  shields: z.array(ShieldSchema).min(1),
  startingPackages: z.array(StartingPackageSchema).min(1),
  equipmentRules: EquipmentRulesSchema,
  traditions: z.array(TraditionSchema).min(1),
  classOptions: z.array(ClassOptionSchema).min(1),
} as const;
export type ContentData = {
  [K in keyof typeof ContentSchemas]: z.infer<(typeof ContentSchemas)[K]>;
};
