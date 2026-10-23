import { z } from 'zod';
import { AttributeSchema, DiceSchema, IdSchema } from './common.ts';
import { ComponentTypeSchema } from './crafting-content.ts';
import { GearSchema } from './gear.ts';

const Difficulty = z.int().min(2).max(20);
const Percent = z.int().min(0).max(100);

/**
 * What drinking a potion does (docs/rules-adaptation.md, Potions; vendor/wwn-srd/4.0 Magic and
 * Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.2). Healing revives the dying and
 * adds System Strain; the others ease strain, lift Sleepless and Cold, oil a weapon for the fight,
 * or hide the party from a group that spotted it.
 */
export const PotionEffectSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('heal'), dice: DiceSchema, strain: z.int().min(0) }),
  z.strictObject({ kind: z.literal('ease-strain'), amount: z.int().min(1) }),
  z.strictObject({ kind: z.literal('wake') }),
  z.strictObject({ kind: z.literal('edge'), hit: z.int().min(1), damage: z.int().min(0) }),
  z.strictObject({ kind: z.literal('vanish') }),
]);
export type PotionEffect = z.infer<typeof PotionEffectSchema>;

/** A potion: gear in the SRD's shape whose cost is what brewing it costs, plus its effect. */
export const PotionSchema = z.strictObject({
  ...GearSchema.shape,
  text: z.string().min(1),
  effect: PotionEffectSchema,
});
export type Potion = z.infer<typeof PotionSchema>;

/** A town's alchemist (docs/rules-adaptation.md, Potions: Alchemists; Sam's calls). */
export const AlchemistSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  town: IdSchema,
  text: z.string().min(1),
  /** The recipes they keep in stock and brew on commission. */
  wares: z.array(IdSchema).min(1),
});
export type Alchemist = z.infer<typeof AlchemistSchema>;

/** Brewing, potions, and alchemists (docs/rules-adaptation.md, Potions). */
export const AlchemyContentSchema = z.strictObject({
  /** The skill brewing takes and is rolled with, and its attributes. */
  skill: IdSchema,
  attributes: z.array(AttributeSchema).min(1),
  /** SRD 4.10.0: a week for a single-use item. */
  brewDays: z.int().min(1),
  /** SRD 4.10.0: two doses for +1 difficulty, four for +2. */
  batches: z.array(z.strictObject({ doses: z.int().min(1), difficulty: z.int().min(0) })).min(1),
  /** SRD 4.10.0: an apprentice adds this to the check; here, another party member with the skill. */
  assistBonus: z.int().min(0),
  /** The party pays this share of a potion's brewing cost for its reagents (Sam's call). */
  makeFraction: z.number().positive().max(1),
  /** The kit a brewer carries to brew, and to work on a brew in camp (Sam's call). */
  kit: GearSchema,
  /** Ready-made potions cost this many times the brewing cost (Sam's call). */
  stockMultiplier: z.number().min(1),
  /** Ready-made lines an alchemist has each month: 0 to this many, of 1 to `maxDoses` each. */
  maxStock: z.int().min(0),
  maxDoses: z.int().min(1),
  /** Percent chances a won fight drops a potion: a boss fight, or any other with humanoids. */
  drops: z.strictObject({ boss: Percent, humanoid: Percent }),
  potions: z.array(PotionSchema).min(1),
  /**
   * What can be brewed: a potion or other gear (the antidote), its difficulty, its weight in
   * stock and drops (0 never drops or stocks), and the components a batch takes (Sam's call).
   */
  recipes: z
    .array(
      z.strictObject({
        item: IdSchema,
        difficulty: Difficulty,
        weight: z.int().min(0),
        components: z.array(z.strictObject({ type: ComponentTypeSchema, count: z.int().min(1) })),
      }),
    )
    .min(1),
  alchemists: z.array(AlchemistSchema),
});
export type AlchemyContent = z.infer<typeof AlchemyContentSchema>;

/** An alchemist's month: their ready-made stock, by recipe item. */
export const AlchemistStateSchema = z.strictObject({
  since: z.int().min(0),
  stock: z.record(IdSchema, z.int().min(1)),
});
export type AlchemistState = z.infer<typeof AlchemistStateSchema>;

/** A potion brewed to order, collected in the alchemist's town once ready. */
export const BrewOrderSchema = z.strictObject({
  alchemist: IdSchema,
  item: IdSchema,
  doses: z.int().min(1),
  readyDay: z.int().min(0),
});
export type BrewOrder = z.infer<typeof BrewOrderSchema>;
