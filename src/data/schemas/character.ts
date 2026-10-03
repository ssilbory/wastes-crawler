import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';

export const CHARACTER_SCHEMA_VERSION = 1;

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
  }),
  /** Skill id → level 0–4. */
  skills: z.record(IdSchema, z.int().min(0).max(4)),
  classes: z.strictObject({
    current: IdSchema,
    levels: z.record(IdSchema, z.int().min(0)),
  }),
  hp: z.strictObject({ max: z.int().min(1), current: z.int().min(0) }),
  xp: z.int().min(0),
  strain: z.strictObject({ value: z.int().min(0), broken: z.boolean() }),
});
export type Character = z.infer<typeof CharacterSchema>;
