import { z } from 'zod';
import { IdSchema } from './common.ts';

/**
 * The economy validator's model (docs/rules-adaptation.md, Economy validator in Phase 9): an
 * abstract party that delves and comes back to town, with rates measured from the combat sim.
 */
export const EconomySimSchema = z.strictObject({
  party: z.strictObject({
    /** Each PC's starting maximum hit points; the party size follows. */
    maxHp: z.array(z.int().min(1)).min(1).max(6),
    /** Maximum hit points gained per level. */
    hpPerLevel: z.number().positive(),
    purse: z.number().min(0),
  }),
  delve: z.strictObject({
    /** The encounter table each fight is drawn from, for its loot dice. */
    table: IdSchema,
    /** The party level the delve's fights are pitched at. */
    level: z.int().min(1),
    fights: z.int().min(1),
    days: z.int().min(1),
  }),
  fight: z.strictObject({
    /** Average share of a PC's maximum hit points lost per fight; each fight takes 0 to twice it. */
    hpLost: z.number().min(0).max(1),
    /** Chance per fight that a given PC dies, at the dungeon's level. */
    deathChance: z.number().min(0).max(1),
    /** The death chance is multiplied by this for each level the party's best PC is above it. */
    deathFalloff: z.number().min(0).max(1),
    /** XP each living PC earns per fight. */
    xp: z.number().min(0),
  }),
  /** Hireling types the party signs on at home and keeps, paid their loot shares (Phase 12f). */
  hirelings: z.array(IdSchema).max(2),
  /** Every so many delves, the party takes on this ruin instead (Phase 12f). */
  ruin: z.strictObject({ id: IdSchema, every: z.int().min(1) }),
  /** A raising quest: days it takes the party, at most one taken a month. */
  raiseQuest: z.strictObject({ days: z.int().min(1) }),
  /** Days on the road between towns. */
  travelDays: z.int().min(0),
  policies: z.array(z.strictObject({ id: IdSchema, towns: z.array(IdSchema).min(1) })).min(1),
  seeds: z.int().min(1),
  delves: z.int().min(1),
  lockouts: z.strictObject({
    /** Loot paying nothing in the party's town for more than this many days. */
    worthlessDays: z.int().min(1),
    /** No PC gaining a level for this many delves while every PC is below `belowLevel`. */
    stuckDelves: z.int().min(1),
    belowLevel: z.int().min(2),
  }),
});
export type EconomySim = z.infer<typeof EconomySimSchema>;
