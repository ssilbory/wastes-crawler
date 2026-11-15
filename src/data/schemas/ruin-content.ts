import { z } from 'zod';
import { IdSchema } from './common.ts';
import { LootDiceSchema } from './town-content.ts';

/** Each kind's level sizes, in cells (Sam's calls). */
export const RUIN_SIZES = {
  delve: { min: 12, max: 15 },
  tower: { min: 7, max: 10 },
  city: { min: 18, max: 21 },
  /** A lair's levels are this many cells long and five high. */
  lair: { min: 14, max: 24 },
} as const;

const Group = z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3);

/**
 * A ruin site (docs/decisions/0004-procedural-levels.md; Sam's calls in Phase 12e): an optional side
 * dungeon on a fixed hex whose levels are generated from the world's RNG on first entry, with loot
 * caches and a guarded vault. A delve goes down to its vault, a tower climbs up to it, a city is one
 * level of streets and buildings, with a sewer below for some, and a lair is a straight run of
 * rooms down to its boss (Sam's call).
 */
export const RuinSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  kind: z.enum(['delve', 'tower', 'city', 'lair']),
  /** A city with a sewer level below it, where its vault lies. */
  sewer: z.boolean().optional(),
  region: IdSchema,
  col: z.int().min(0),
  row: z.int().min(0),
  /** The party level the ruin is meant for: its vault is tuned to it (Phase 12f). */
  level: z.int().min(1),
  /** Levels or floors, each a step denser with traps; a city's is 1. */
  depth: z.int().min(1).max(4),
  /** Each level's width and height are drawn from this range of cells, within the kind's sizes. */
  size: z.strictObject({ min: z.int().min(5), max: z.int().max(24) }),
  wander: z.strictObject({ every: z.int().min(1).max(6), table: IdSchema }),
  /** Loot dice in each small cache. */
  cache: z.array(LootDiceSchema).min(1),
  /** A lair's bands of minions, one met in each of its middle rooms. */
  minions: z.array(Group).min(1).optional(),
  /** What the party sees as a band of minions rises. */
  minionText: z.string().min(1).optional(),
  vault: z.strictObject({
    guards: Group,
    /** What the party sees as the vault's guards rise. */
    text: z.string().min(1).optional(),
    loot: z.array(LootDiceSchema).min(1),
    component: IdSchema.optional(),
  }),
});
export type Ruin = z.infer<typeof RuinSchema>;
