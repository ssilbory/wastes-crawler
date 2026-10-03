import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';
import { ItemLocationSchema } from './equipment-content.ts';

export const CHARACTER_SCHEMA_VERSION = 5;

const Score = z.int().min(3).max(18);
const Adjustments = z.partialRecord(AttributeSchema, z.int());

/**
 * A saved character. Final attribute scores, modifiers, attack bonus, and saves are derived, so an
 * edited file only needs its inputs to be valid.
 */
export const CharacterSchema = z.strictObject({
  schemaVersion: z.literal(CHARACTER_SCHEMA_VERSION),
  id: z.string().regex(/^char-[0-9a-f]{8,}$/),
  name: z.string().trim().min(1).max(60),
  goal: z.string().max(200),
  people: IdSchema,
  /** Required for peoples that have lineages. */
  lineage: IdSchema.optional(),
  background: IdSchema,
  attributes: z.strictObject({
    /** Scores from the standard array, before any adjustment. */
    base: z.record(AttributeSchema, Score),
    /** The people's modifiers as applied after clamping to 3–18. */
    people: Adjustments,
    /** Background Growth bonuses. */
    background: Adjustments,
    /** Attribute boosts bought with skill points (SRD 2.7.1.5). */
    advancement: Adjustments,
  }),
  /** Racial and class foci with their levels; Developed Attribute appears once per attribute. */
  foci: z.array(
    z.strictObject({
      id: IdSchema,
      level: z.int().min(1).max(2),
      attribute: AttributeSchema.optional(),
    }),
  ),
  /** Mage arts, automatic ones included. */
  arts: z.array(IdSchema),
  /** Spells in the grimoire, and those prepared from it. */
  spells: z.strictObject({ known: z.array(IdSchema), prepared: z.array(IdSchema) }),
  /** Carried items; worn armor and shields count as Readied. */
  inventory: z.array(
    z.strictObject({
      id: IdSchema,
      quantity: z.int().min(1),
      location: ItemLocationSchema,
      small: z.literal(true).optional(),
      barding: z.literal(true).optional(),
    }),
  ),
  /** Money; 1 crown = 1 silver piece, so copper prices make tenths. */
  crowns: z.number().min(0),
  /** Skill id → level 0–4. */
  skills: z.record(IdSchema, z.int().min(0).max(4)),
  classes: z.strictObject({
    current: IdSchema,
    levels: z.record(IdSchema, z.int().min(0)),
  }),
  hp: z.strictObject({ max: z.int().min(1), current: z.int().min(0) }),
  /** Fight awards come in half points (docs/rules-adaptation.md, XP). */
  xp: z.number().min(0).multipleOf(0.5),
  /** Skill points saved for later (SRD 2.7.1.4). */
  advancement: z.strictObject({
    skillPoints: z.int().min(0),
    /** Quick Learner points: non-combat skills or attributes only (SRD 1.5.8). */
    quickPoints: z.int().min(0),
    /** A focus's bonus skill points short of the skill's next level (SRD 2.7.1.6). */
    skillCredit: z.record(IdSchema, z.int().min(1)),
  }),
  strain: z.strictObject({ value: z.int().min(0), broken: z.boolean() }),
});
export type Character = z.infer<typeof CharacterSchema>;
