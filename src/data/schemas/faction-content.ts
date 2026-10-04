import { z } from 'zod';
import { DiceSchema, IdSchema } from './common.ts';
import { FactionAttributeSchema, FactionMagicSchema } from './factions.ts';

const Rating = z.int().min(1).max(8);

/** A place assets stand and bases are built (6.3.0): a hex on a region map. */
export const FactionLocationSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  region: IdSchema,
  col: z.int().min(0),
  row: z.int().min(0),
});
export type FactionLocation = z.infer<typeof FactionLocationSchema>;

/**
 * An SRD asset the factions may buy (Sam's call: a curated subset), with the special ability from
 * its SRD text where it has one: Treasure rolled each turn on 1d6 (Farmers, Manufactory), damage
 * the asset takes after it attacks or defends (Temple Fanatics), or Treasure taken from the target
 * on a successful Attack (Front Merchant, Siege Experts).
 */
export const FactionAssetRuleSchema = z.strictObject({
  asset: IdSchema,
  special: z
    .discriminatedUnion('kind', [
      /** Treasure gained (or lost) for each face of 1d6, from 1 to 6. */
      z.strictObject({ kind: z.literal('income'), faces: z.array(z.int()).length(6) }),
      z.strictObject({ kind: z.literal('self-harm'), damage: DiceSchema }),
      z.strictObject({
        kind: z.literal('steal'),
        amount: z.union([z.int().min(1), DiceSchema]),
        oncePerTurn: z.boolean(),
      }),
    ])
    .optional(),
});
export type FactionAssetRule = z.infer<typeof FactionAssetRuleSchema>;

/** The SRD's example goals the factions pursue (6.7.0). */
export const FactionGoalKindSchema = z.enum(['blood-the-enemy', 'root-out', 'peaceable-kingdom']);
export type FactionGoalKind = z.infer<typeof FactionGoalKindSchema>;

/** 6.5.0 tags: an extra die on checks of one attribute, or cheaper small assets. */
export const FactionTagSchema = z.enum(['martial', 'machiavellian', 'rich', 'populist']);
export type FactionTag = z.infer<typeof FactionTagSchema>;

/**
 * A faction (6.7.0): its ratings and Magic, tags, headquarters, starting Treasure, other Bases of
 * Influence and assets, the assets it buys, its goals in turn, its rivals, and the order it raises
 * attributes with experience, and what it calls its assets.
 */
export const FactionSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  text: z.string().min(1),
  force: Rating,
  cunning: Rating,
  wealth: Rating,
  magic: FactionMagicSchema,
  tags: z.array(FactionTagSchema),
  hq: IdSchema,
  treasure: z.int().min(0),
  bases: z.array(z.strictObject({ at: IdSchema, hp: z.int().min(1) })),
  assets: z.array(z.strictObject({ asset: IdSchema, at: IdSchema })),
  buys: z.array(IdSchema).min(1),
  goals: z.array(FactionGoalKindSchema).min(1),
  enemies: z.array(IdSchema),
  raise: z.array(FactionAttributeSchema).length(3),
  /** What its assets are called in the news, where the SRD name doesn't fit. */
  names: z.record(IdSchema, z.string().min(1)),
});
export type Faction = z.infer<typeof FactionSchema>;

export const FactionContentSchema = z.strictObject({
  locations: z.array(FactionLocationSchema).min(1),
  assets: z.array(FactionAssetRuleSchema).min(1),
  factions: z.array(FactionSchema).min(1),
});
export type FactionContent = z.infer<typeof FactionContentSchema>;

/** A faction's state in a world save (Phase 13): ratings, wounds, Treasure, bases, and assets. */
export const FactionStateSchema = z.strictObject({
  force: Rating,
  cunning: Rating,
  wealth: Rating,
  /** At 0 the faction has collapsed (6.1.0). */
  hp: z.int().min(0),
  treasure: z.int().min(0),
  xp: z.int().min(0),
  bases: z.array(z.strictObject({ at: IdSchema, hp: z.int().min(1), max: z.int().min(1) })),
  assets: z.array(
    z.strictObject({ uid: z.string().min(1), asset: IdSchema, at: IdSchema, hp: z.int().min(1) }),
  ),
  goal: z
    .strictObject({
      kind: FactionGoalKindSchema,
      /** Root Out the Enemy: the rival and the location of the base to destroy. */
      target: z.strictObject({ faction: IdSchema, at: IdSchema }).nullable(),
      /** Damage dealt, turns without an Attack, or 1 once the base falls to this faction. */
      progress: z.int().min(0),
    })
    .nullable(),
  /** The next goal in the faction's list. */
  goalIndex: z.int().min(0),
  /** An abandoned goal costs the next turn's action (6.2.0). */
  idle: z.boolean(),
  /** Numbers new assets. */
  serial: z.int().min(0),
});
export type FactionState = z.infer<typeof FactionStateSchema>;
