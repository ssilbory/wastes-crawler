import { z } from 'zod';
import { AttributeSchema, CostSchema, DiceSchema, IdSchema } from './common.ts';

const Level = z.int().min(1).max(2);

/** Melee swings, thrown weapons, and shot weapons are separate attack lines (SRD 3.5.1). */
export const AttackModeSchema = z.enum(['melee', 'thrown', 'ranged']);
export type AttackMode = z.infer<typeof AttackModeSchema>;
const Modes = z.array(AttackModeSchema).min(1);

const ShockSchema = z.strictObject({ damage: z.int().min(1), maxAc: z.int().min(10) });

/** A focus's built-in melee attack, such as a beastman's horns. */
export const NaturalWeaponSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  damage: DiceSchema,
  shock: ShockSchema.nullable(),
  attributes: z.array(AttributeSchema).min(1),
  skill: IdSchema,
});
export type NaturalWeapon = z.infer<typeof NaturalWeaponSchema>;

/**
 * Focus benefits that change the numbers on a character sheet, from the focus's level on. Other
 * benefits wait for the systems they touch. `excludesUnarmed` leaves out unarmed and natural
 * attacks, as Armsmaster does.
 */
export const FocusEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({
    kind: z.literal('hit-bonus'),
    level: Level,
    amount: z.int(),
    modes: Modes,
    excludesUnarmed: z.literal(true).optional(),
  }),
  z.strictObject({
    kind: z.literal('damage-adds-skill'),
    level: Level,
    skill: IdSchema,
    modes: Modes,
    /** Also add the skill to melee Shock damage. */
    shock: z.boolean(),
    excludesUnarmed: z.literal(true).optional(),
  }),
  /** Melee Shock applies whatever the target's AC. */
  z.strictObject({
    kind: z.literal('shock-ignores-ac'),
    level: Level,
    excludesUnarmed: z.literal(true).optional(),
  }),
  z.strictObject({ kind: z.literal('shock-bonus'), level: Level, amount: z.int().min(1) }),
  z.strictObject({
    kind: z.literal('unarmed-damage'),
    level: Level,
    /** Damage at Punch-0 through Punch-4. */
    byPunchLevel: z.array(DiceSchema).length(5),
    /** Shock equal to the Punch skill from this level up. */
    shock: z.strictObject({ minPunch: z.int().min(0), maxAc: z.int().min(10) }),
  }),
  /** Base AC of `base` plus half the character level, rounded up. */
  z.strictObject({ kind: z.literal('innate-ac'), level: Level, base: z.int().min(10) }),
  z.strictObject({ kind: z.literal('natural-weapon'), level: Level, weapon: NaturalWeaponSchema }),
  /** Raises the Stowed limit by half Strength, rounded down. */
  z.strictObject({ kind: z.literal('extra-stowed-half-strength'), level: Level }),
  /** Close Combatant: ignore Shock from melee attackers. */
  z.strictObject({ kind: z.literal('melee-shock-immune'), level: Level }),
  /** Deadeye: two-handed ranged weapons work with a foe in melee, at this hit modifier. */
  z.strictObject({ kind: z.literal('ranged-in-melee'), level: Level, modifier: z.int() }),
  /** Alert: a bonus to the side's initiative roll (not stacking), or acting first. */
  z.strictObject({
    kind: z.literal('initiative'),
    level: Level,
    bonus: z.int(),
    actsFirst: z.boolean(),
  }),
  /** Armored Magic: cast in armor up to this encumbrance (null for any), and with a shield. */
  z.strictObject({
    kind: z.literal('armored-casting'),
    level: Level,
    maxEncumbrance: z.int().min(0).nullable(),
    shields: z.boolean(),
  }),
]);
export type FocusEffect = z.infer<typeof FocusEffectSchema>;

/** House-rule shields (docs/rules-adaptation.md, Shields): AC = max(base, armor + bonus). */
export const ShieldSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  baseAc: z.int().min(10),
  bonus: z.int().min(0),
  /** Attacks against and made by the bearer have disadvantage. */
  cover: z.boolean(),
  cost: CostSchema,
  encumbrance: z.int().min(0),
});
export type Shield = z.infer<typeof ShieldSchema>;

export const ItemLocationSchema = z.enum(['worn', 'readied', 'stowed']);
export type ItemLocation = z.infer<typeof ItemLocationSchema>;

/** A starting equipment package (SRD 1.7.7), sized for the character when it's chosen. */
export const StartingPackageSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
  items: z
    .array(
      z.strictObject({
        id: IdSchema,
        quantity: z.int().min(1),
        location: ItemLocationSchema,
      }),
    )
    .min(1),
  crowns: z.int().min(0),
});
export type StartingPackage = z.infer<typeof StartingPackageSchema>;

export const EquipmentRulesSchema = z.strictObject({
  /** Centaur barding: the matching armor's AC at a multiple of its cost and encumbrance. */
  barding: z.strictObject({
    costMultiplier: z.int().min(1),
    encumbranceMultiplier: z.int().min(1),
  }),
  /** Weapons usable without the unskilled -2, such as the crossbow (SRD 3.5.2). */
  noUnskilledPenalty: z.array(IdSchema),
  /** Weapons with this trait count this many to one Readied item (the N trait). */
  numerous: z.strictObject({ trait: IdSchema, perItem: z.int().min(2) }),
  /** SRD 1.7.7: 3d6 x 10 silver, paid in crowns. */
  startingCrowns: z.strictObject({ dice: DiceSchema, multiplier: z.int().min(1) }),
});
export type EquipmentRules = z.infer<typeof EquipmentRulesSchema>;
