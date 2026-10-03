import { z } from 'zod';
import { IdSchema } from './common.ts';

const Crowns = z.number().min(0);

/** A crafted item's quality tier (SRD 2.8.1); normal gear carries no tier on the sheet. */
export const QualitySchema = z.enum(['jury-rigged', 'mastercrafted']);
export type Quality = z.infer<typeof QualitySchema>;

const Tier = z.strictObject({
  /** Parts cost as a multiple of the market cost. */
  cost: z.number().positive(),
  /** Build time as a multiple of the normal time. */
  time: z.number().positive(),
});

/** Crafting numbers (docs/rules-adaptation.md, Crafting and modifying gear). */
export const CraftingRulesSchema = z.strictObject({
  /** Days to build a normal item of each kind (SRD 2.8.1: a week for a weapon or armor). */
  buildDays: z.strictObject({
    weapon: z.int().min(1),
    armor: z.int().min(1),
    shield: z.int().min(1),
    gear: z.int().min(1),
  }),
  quality: z.strictObject({ 'jury-rigged': Tier, mastercrafted: Tier }),
  mods: z.strictObject({
    /** SRD 2.8.2: a week per Craft level of the mod, halved working full time. */
    daysPerLevel: z.int().min(1),
    /** Removing a mod takes a day. */
    stripDays: z.int().min(1),
  }),
  upkeep: z.strictObject({
    /** SRD 2.8.3: unmaintained this long, the item itself stops working. */
    brokenAfterDays: z.int().min(1),
    /** Sam's call: a broken weapon's to-hit and broken armor's AC drop by this much. */
    penalty: z.int().min(0),
  }),
  workshop: z.strictObject({
    /** Rent for a day of work in a town's workshop. */
    rentPerDay: Crowns,
    /** Buying a town's workshop outright; then it is free to use. */
    price: Crowns,
  }),
});
export type CraftingRules = z.infer<typeof CraftingRulesSchema>;

export const ComponentTypeSchema = z.enum(['hide', 'wood', 'metal', 'gem', 'essence']);
export type ComponentType = z.infer<typeof ComponentTypeSchema>;

/** A crafting component, standing in for the SRD's arcane salvage (SRD 2.8.2). */
export const ComponentSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  type: ComponentTypeSchema,
  rarity: z.enum(['common', 'uncommon', 'rare']),
  /** Monsters that can drop it: each one beaten drops one with this percent chance. */
  sources: z.array(z.strictObject({ monster: IdSchema, chance: z.int().min(1).max(100) })),
});
export type Component = z.infer<typeof ComponentSchema>;

/** A mod (SRD 2.8.2, 2.8.4): built for one weapon or suit of armor, paid in loot dice. */
export const ModSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** The Craft level needed to build and maintain it. */
  minCraft: z.int().min(0).max(5),
  targets: z.array(z.enum(['weapon', 'armor'])).min(1),
  /** Only ranged or thrown weapons. */
  rangedOnly: z.literal(true).optional(),
  /** Paid in exactly this many loot dice, each this size or larger. */
  loot: z.strictObject({ count: z.int().min(1), sides: z.int().min(2) }),
  components: z.array(z.strictObject({ type: ComponentTypeSchema, count: z.int().min(1) })),
  weapon: z.strictObject({ hit: z.int().optional(), damage: z.int().optional() }).optional(),
  armor: z.strictObject({ ac: z.int().optional(), encumbrance: z.int().optional() }).optional(),
  text: z.string().min(1),
});
export type Mod = z.infer<typeof ModSchema>;
