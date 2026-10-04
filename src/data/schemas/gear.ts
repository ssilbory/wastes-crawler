import { z } from 'zod';
import { CostSchema, recordBase } from './common.ts';

export const GearSchema = z.strictObject({
  ...recordBase,
  cost: CostSchema,
  /** Null when the SRD lists N/A, or when the item is effectively weightless. */
  encumbrance: z.int().min(0).nullable(),
  /** SRD *: effectively weightless in modest numbers. */
  weightless: z.boolean(),
  /** SRD §: doesn't count for encumbrance while worn. */
  freeWhenWorn: z.boolean(),
  /** SRD #: bundles of three count as one item. */
  bundlesOfThree: z.boolean(),
});
export type Gear = z.infer<typeof GearSchema>;

/** SRD 3.2.1: all the non-weapon, non-armor gear a role needs, as one item. */
export const GearBundleSchema = z.strictObject({
  ...recordBase,
  cost: CostSchema,
  encumbrance: z.int().min(0),
});
export type GearBundle = z.infer<typeof GearBundleSchema>;
