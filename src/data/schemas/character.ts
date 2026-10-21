import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';
import { QualitySchema } from './crafting-content.ts';
import { ItemLocationSchema } from './equipment-content.ts';

export const CHARACTER_SCHEMA_VERSION = 7;

/** A Skinshifter's alternate form (1.5.15): up to three arts applied to it. */
export const FormSchema = z.strictObject({
  name: z.string().trim().min(1).max(40),
  /** A humanoid shape takes the form bonus to hit only with Warform. */
  humanoid: z.boolean(),
  arts: z.array(IdSchema).max(3),
  /** The attribute Feral Prowess raises in this form. */
  feral: z.enum(['str', 'dex', 'con']).optional(),
});
export type Form = z.infer<typeof FormSchema>;

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
    /** Scores from the standard array, 3d6, or the player's choice, before any adjustment. */
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
  /** A Skinshifter's alternate forms, one per character level at most. */
  forms: z.array(FormSchema).optional(),
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
      /** A crafted weapon, armor, or shield's tier; normal items have none (SRD 2.8.1). */
      quality: QualitySchema.optional(),
      /** Marks one crafted or modded item so work can find it again. */
      serial: z.string().min(1).optional(),
      /** The character id of a mastercrafted item's creator (SRD 2.8.1). */
      maker: z.string().min(1).optional(),
      /** Installed mods, with the components they used (SRD 2.8.2). */
      mods: z
        .array(
          z.strictObject({
            id: IdSchema,
            components: z.array(IdSchema),
            /** The creator's first mod on a mastercrafted item needs no maintenance. */
            free: z.literal(true).optional(),
          }),
        )
        .optional(),
      /** A magic weapon's bonus to hit, damage, and Shock, or magic armor's to AC (SRD 4.9.3). */
      bonus: z.int().min(1).max(3).optional(),
      /** Days since its mods were last maintained (SRD 2.8.3). */
      upkeep: z.int().min(1).optional(),
      /** A scroll's spell and the caster level it goes off at (SRD 4.9.1). */
      spell: IdSchema.optional(),
      casterLevel: z.int().min(1).optional(),
    }),
  ),
  /** Money; 1 crown = 1 silver piece, so copper prices make tenths. */
  crowns: z.number().min(0),
  /** Skill id → level 0–4. */
  skills: z.record(IdSchema, z.int().min(0).max(4)),
  classes: z.strictObject({
    current: IdSchema,
    levels: z.record(IdSchema, z.int().min(0)),
    from: IdSchema.optional(),
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
    /** Focus picks owed for a focus the game took away, taken in town at any time. */
    freeFoci: z.int().min(1).optional(),
  }),
  strain: z.strictObject({ value: z.int().min(0), broken: z.boolean() }),
  /**
   * Flesh reshaped by a Necromancer's Boneshaper until they lift it: the caster's character id, and
   * the changes to attribute modifiers, each within ±2 (vendor/wwn-srd/4.0 Magic and Spellcasting/
   * 4.6.0 Necromancer Spells.md).
   */
  shaped: z
    .strictObject({
      by: z.string().min(1),
      changes: z.partialRecord(AttributeSchema, z.int().min(-2).max(2)),
    })
    .optional(),
});
/** A character read from a save: current hit points can't be above the maximum. */
export const SavedCharacterSchema = CharacterSchema.refine((c) => c.hp.current <= c.hp.max, {
  message: 'current HP is above maximum HP',
  path: ['hp', 'current'],
});
export type Character = z.infer<typeof CharacterSchema>;
