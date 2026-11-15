import { z } from 'zod';
import { IdSchema } from './common.ts';
import { TrapSchema } from './dungeon-content.ts';

/**
 * A trap set on a vault or a boss's chest (docs/rules-adaptation.md, Locks and chests): its name,
 * the save each PC makes when it springs, and what it does. Its notice and disarm difficulties are
 * the chest's own, set by level, and it is always disarmed with Dex/Sneak (SRD 1.2.0). An alarm has
 * no wanderers to call above ground, so a chest trap does harm.
 */
export const ChestTrapSchema = TrapSchema.pick({
  name: true,
  save: true,
  element: true,
  effect: true,
}).refine((t) => t.effect.kind !== 'alarm', 'a chest trap does harm, not an alarm');
export type ChestTrap = z.infer<typeof ChestTrapSchema>;

/** Locked vaults, boss chests, random chests, and doors (docs/rules-adaptation.md, Locks and chests). */
export const ChestRulesSchema = z.strictObject({
  /** Lock and trap difficulty: base + level / perLevels, rounded down, at most cap. */
  difficulty: z.strictObject({
    base: z.int().min(1),
    perLevels: z.int().min(1),
    cap: z.int().min(1),
  }),
  /** The gear bundle that picks locks and works chest traps, and the penalty without it. */
  tools: z.strictObject({ item: IdSchema, without: z.int().max(0) }),
  /** The bar that helps force a lock, and its bonus. */
  crowbar: z.strictObject({ item: IdSchema, bonus: z.int().min(0) }),
  traps: z.array(ChestTrapSchema).min(1),
  /** A heavily trapped chest: its trap's difficulty raised, and its damage dice multiplied. */
  heavy: z.strictObject({ difficulty: z.int().min(0), damage: z.int().min(1) }),
  /** Locked doors below ground (Sam's calls). */
  doors: z.strictObject({
    /** One door in this many in a ruin is locked. */
    lockedIn: z.int().min(1),
    /** One locked door in this many is trapped. */
    trappedIn: z.int().min(1),
    /** Each try at breaking a door down brings the level's wanderers on this many in 6. */
    noise: z.int().min(0).max(6),
    /** The difficulty of a locked door where no ruin sets a level. */
    difficulty: z.int().min(1),
  }),
  /** Random chests in each ruin level, and what an animated one is when it is one creature. */
  random: z.strictObject({
    min: z.int().min(0),
    max: z.int().min(0),
    mimic: IdSchema,
  }),
});
export type ChestRules = z.infer<typeof ChestRulesSchema>;
