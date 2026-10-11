import { z } from 'zod';
import { IdSchema } from './common.ts';
import { GearSchema } from './gear.ts';

const Crowns = z.number().min(0);

/** A crafted item's quality tier (SRD 2.8.1); normal gear carries no tier on the sheet. */
export const QualitySchema = z.enum(['jury-rigged', 'mastercrafted']);
export type Quality = z.infer<typeof QualitySchema>;

const Weights = z.strictObject({
  'jury-rigged': z.int().min(0),
  normal: z.int().min(0),
  mastercrafted: z.int().min(0),
});

/**
 * Weapons and armor dropped by beaten humanoids (docs/rules-adaptation.md, Gear drops; Sam's
 * calls): the chance a won fight that pays XP drops one, the tier by party level, the costly
 * armors that only drop where mastercrafted gear would, and the magic chance in boss fights.
 */
const DropsSchema = z.strictObject({
  /** Percent chance a qualifying won fight drops a weapon or suit of armor. */
  chance: z.int().min(0).max(100),
  /** Percent chance a boss fight (a quest's fixed fight or a vault's guards) drops a magic one. */
  magicChance: z.int().min(0).max(100),
  /** Tier weights by party level; the band with the highest minimum at or below it applies. */
  bands: z
    .array(z.strictObject({ minLevel: z.int().min(1), weights: Weights }))
    .min(1)
    .refine((bands) => bands.some((b) => b.minLevel === 1), 'a band must start at level 1'),
  /** Armor only dropped where mastercrafted gear could be, and then as normal quality. */
  lateArmor: z.array(IdSchema),
  /** The share of a fight's loot dice a drop always leaves (rounded up). */
  lootKept: z.number().min(0).max(1),
});

const Tier = z.strictObject({
  /** Parts cost as a multiple of the market cost. */
  cost: z.number().positive(),
  /** Build time as a multiple of the normal time. */
  time: z.number().positive(),
});

/** Crafting numbers (docs/rules-adaptation.md, Crafting and modifying gear). */
export const CraftingRulesSchema = z.strictObject({
  /** XP a crafter earns for each day of work on a project, so they keep pace (Sam's call). */
  xpPerDay: z.number().min(0),
  /** Days of work a crafting shift in camp is worth, with crafting tools (Sam's call). */
  shiftDays: z.number().positive().multipleOf(0.5),
  /** The crafting tools that let a crafter work in camp (Sam's call; SRD 2.8.1's workshop). */
  tools: GearSchema,
  drops: DropsSchema,
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
  /** Magic weapons (SRD 4.9.3; prices from the 4.10.0 creation table, Sam's call). */
  magic: z.strictObject({
    tiers: z
      .array(
        z.strictObject({
          bonus: z.int().min(1).max(3),
          /** A craftsman's commission: crowns, days, and components. */
          commission: Crowns,
          days: z.int().min(1),
          components: z.array(
            z.strictObject({ type: z.lazy(() => ComponentTypeSchema), count: z.int().min(1) }),
          ),
          /** Ready-made in a craftsman's stock. */
          stockPrice: Crowns,
          /** How often stock rolls this bonus, against the other tiers. */
          weight: z.int().min(1),
        }),
      )
      .length(3),
  }),
  craftsmen: z.strictObject({
    /** Ready-made magic weapons in stock each month: 0 to this many. */
    maxStock: z.int().min(0),
    /** Components for sale each month. */
    partsStock: z.int().min(0),
    /** What a craftsman pays for a component of each rarity. */
    componentPrices: z.strictObject({ common: Crowns, uncommon: Crowns, rare: Crowns }),
    /** Components sell for this many times what craftsmen pay. */
    sellMarkup: z.number().min(1),
    /** The share of crowns spent with a craftsman that counts toward the town's threshold. */
    thresholdShare: z.number().min(0).max(1),
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

/** A town's craftsman (docs/rules-adaptation.md, Crafting and modifying gear: Craftsmen). */
export const CraftsmanSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  town: IdSchema,
  text: z.string().min(1),
  /** Crowns a month for buying loot and components. */
  tradePool: z.number().min(0),
  /** Weapons they forge as magic weapons, on commission or for stock. */
  weapons: z.array(IdSchema).min(1),
  /** Body armor they make as magic armor (SRD 4.9.3), on commission or for stock. */
  armor: z.array(IdSchema),
});
export type Craftsman = z.infer<typeof CraftsmanSchema>;
