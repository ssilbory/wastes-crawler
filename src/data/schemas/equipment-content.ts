import { z } from 'zod';
import { HeldSchema } from './figure-content.ts';
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
  /** The Vowed's Unarmed Might: the punch's damage and Shock from the class table (1.5.17). */
  z.strictObject({
    kind: z.literal('vowed-punch'),
    level: Level,
    hit: z.int().min(0),
    damage: DiceSchema,
    shock: z.strictObject({ damage: z.int().min(1), maxAc: z.int().min(10) }),
  }),
  /** Base AC of `base` plus half the character level, rounded up. */
  z.strictObject({ kind: z.literal('innate-ac'), level: Level, base: z.int().min(10) }),
  z.strictObject({ kind: z.literal('natural-weapon'), level: Level, weapon: NaturalWeaponSchema }),
  /** Raises the Stowed limit by half Strength, rounded down. */
  z.strictObject({ kind: z.literal('extra-stowed-half-strength'), level: Level }),
  /** Close Combatant: ignore Shock from melee attackers. */
  z.strictObject({ kind: z.literal('melee-shock-immune'), level: Level }),
  /** Die Hard: falling to zero HP leaves the character stable and Frail, not dying (1.6.0). */
  z.strictObject({ kind: z.literal('self-stabilize'), level: Level }),
  /** Die Hard: the first time each day an injury would drop the character to zero, 1 HP is left. */
  z.strictObject({ kind: z.literal('last-stand'), level: Level }),
  /** Deadeye: two-handed ranged weapons work with a foe in melee, at this hit modifier. */
  z.strictObject({ kind: z.literal('ranged-in-melee'), level: Level, modifier: z.int() }),
  /** Alert: a bonus to the side's initiative roll (not stacking), or acting first. */
  z.strictObject({
    kind: z.literal('initiative'),
    level: Level,
    bonus: z.int(),
    actsFirst: z.boolean(),
  }),
  /** Herd-Loyal: hirelings travelling with the party get this much more Morale (Phase 12b). */
  z.strictObject({ kind: z.literal('hireling-morale'), level: Level, amount: z.int().min(1) }),
  /** Well-Met: a bonus to reaction rolls while the character travels with the party. */
  z.strictObject({ kind: z.literal('reaction-bonus'), level: Level, amount: z.int().min(1) }),
  /**
   * Opens parley with these kinds of minds (docs/rules-adaptation.md, Parley), and with
   * `evenAggressive`, even with groups whose reaction is aggressive.
   */
  z.strictObject({
    kind: z.literal('parley'),
    level: Level,
    minds: z.array(z.enum(['animal', 'monster'])),
    evenAggressive: z.boolean(),
  }),
  /** Rider: the rider's mount never panics and uses the rider's AC when higher (Mounts). */
  z.strictObject({ kind: z.literal('steady-steed'), level: Level }),
  /** Rider: once a fight, a hit that would drop the rider's mount is negated. */
  z.strictObject({ kind: z.literal('steed-guard'), level: Level }),
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
  /** Weapons that strike blunt, for creatures that shrug off crushing blows (Phase 14a). */
  bluntWeapons: z.array(IdSchema),
  /** How each SRD weapon looks in hand on the fight screen; presentation only. */
  held: z.record(IdSchema, HeldSchema),
  /** SRD 1.7.7: 3d6 x 10 silver, paid in crowns. */
  startingCrowns: z.strictObject({ dice: DiceSchema, multiplier: z.int().min(1) }),
  /** Stowed items each loot die and each component in the party stash weighs (Party stash). */
  stash: z.strictObject({
    lootDie: z.number().min(0),
    component: z.number().min(0),
    /** What the rations die weighs at each size (Sam's call: Water and fuel). */
    rations: z.strictObject({
      '4': z.number().min(0),
      '6': z.number().min(0),
      '8': z.number().min(0),
      '10': z.number().min(0),
      '12': z.number().min(0),
    }),
  }),
  /**
   * Ammo by item (Resource dice and Ammo, docs/rules-adaptation.md; Sam's calls): the weapons that
   * shoot it, and what fletching one costs in nights' firewood and metal, in quarters.
   */
  ammo: z.record(
    IdSchema,
    z.strictObject({
      weapons: z.array(IdSchema).min(1),
      fletch: z.strictObject({
        firewood: z.int().min(0),
        metal: z.number().min(0).multipleOf(0.25),
      }),
    }),
  ),
});
export type EquipmentRules = z.infer<typeof EquipmentRulesSchema>;
