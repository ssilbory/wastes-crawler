import { z } from 'zod';
import { IdSchema } from './common.ts';
import { LootDiceSchema } from './town-content.ts';

/**
 * A ruin site (docs/decisions/0004-procedural-levels.md; Sam's calls in Phase 12e): an optional side
 * dungeon on a fixed hex whose levels are generated from the world's RNG on first entry, with loot
 * caches on each level and a guarded vault on the deepest.
 */
export const RuinSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  region: IdSchema,
  col: z.int().min(0),
  row: z.int().min(0),
  /** Levels, each a step denser with traps. */
  depth: z.int().min(1).max(3),
  /** Each level's width and height are drawn from this range of cells. */
  size: z.strictObject({ min: z.int().min(8), max: z.int().max(10) }),
  wander: z.strictObject({ every: z.int().min(1).max(6), table: IdSchema }),
  /** Loot dice in each small cache. */
  cache: z.array(LootDiceSchema).min(1),
  vault: z.strictObject({
    guards: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3),
    loot: z.array(LootDiceSchema).min(1),
    component: IdSchema.optional(),
  }),
});
export type Ruin = z.infer<typeof RuinSchema>;
