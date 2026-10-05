import { z } from 'zod';
import { IdSchema } from './common.ts';

/**
 * A grove of walking trees on the overland map (docs/rules-adaptation.md, Groves): a fixed site
 * the party can see and choose to enter, where the trees meet them wary.
 */
export const GroveSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  region: IdSchema,
  col: z.int().min(0),
  row: z.int().min(0),
  /** Read when the party steps in among the trees. */
  text: z.string().min(1),
  /** Rows of trees, front first. */
  enemies: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3),
});
export type Grove = z.infer<typeof GroveSchema>;
