import { z } from 'zod';

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
  workshop: z.strictObject({
    /** Rent for a day of work in a town's workshop. */
    rentPerDay: Crowns,
    /** Buying a town's workshop outright; then it is free to use. */
    price: Crowns,
  }),
});
export type CraftingRules = z.infer<typeof CraftingRulesSchema>;
