import { z } from 'zod';
import { CostSchema, recordBase } from './common.ts';

export const ArmorSchema = z.object({
  ...recordBase,
  category: z.enum(['light', 'medium', 'heavy', 'shield']),
  ac: z.int().min(10),
  cost: CostSchema.nullable(),
  /** Null for No Armor, which has no encumbrance. */
  encumbrance: z.int().min(0).nullable(),
});
export type Armor = z.infer<typeof ArmorSchema>;
