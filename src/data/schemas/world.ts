import { z } from 'zod';
import { IdSchema } from './common.ts';
import { DefaultPresetSchema } from './roster.ts';
import { LootDiceSchema } from './town-content.ts';

export const WORLD_SCHEMA_VERSION = 2;

const HexSchema = z.strictObject({ col: z.int().min(0), row: z.int().min(0) });

/** A party member's overland state; the character keeps its own schemaVersion. */
export const MemberSaveSchema = z.strictObject({
  id: z.string().min(1),
  character: z.unknown(),
  row: z.int().min(0).max(1),
  column: z.int().min(0).max(3),
  defaultAction: DefaultPresetSchema,
  dead: z.boolean(),
  frail: z.boolean(),
  hungry: z.boolean(),
  sleepless: z.boolean(),
  cold: z.boolean(),
  /** Slept a quarter today. */
  slept: z.boolean(),
  /** Spells cast and day Effort spent since the last night's recovery. */
  spellsCast: z.int().min(0),
  effortDay: z.int().min(0),
  /** XP won while dead, granted when raised. */
  pendingXp: z.number().min(0).multipleOf(0.5),
});

export const PendingEncounterSchema = z.strictObject({
  enemies: z.array(z.array(IdSchema)).min(1).max(3),
  /** True when the group means to fight. */
  hostile: z.boolean(),
  /** The party spotted them first and can slip away. */
  spotted: z.boolean(),
  text: z.string(),
});

/** Crowns spent and loot cashed in at one town, at listed value, since `since` (a day). */
export const TownLedgerSchema = z.strictObject({
  spent: z.number().min(0),
  looted: z.number().min(0),
  since: z.int().min(0),
});
export type TownLedger = z.infer<typeof TownLedgerSchema>;

/** A world save (docs/plan.md, Save/load): versioned, with the RNG state. */
export const WorldSaveSchema = z.strictObject({
  schemaVersion: z.literal(WORLD_SCHEMA_VERSION),
  region: IdSchema,
  rng: z.tuple([z.int(), z.int(), z.int(), z.int()]),
  /** Days since the world began, and the quarter: morning, day, evening, night. */
  day: z.int().min(0),
  quarter: z.int().min(0).max(3),
  position: HexSchema,
  destination: HexSchema.nullable(),
  visited: z.array(z.string()),
  rations: z.union([0, 4, 6, 8, 10, 12].map((n) => z.literal(n))),
  /** Quarters spent hiking today. */
  hikes: z.int().min(0),
  /** Tonight's shelter. */
  camp: z.enum(['none', 'made', 'failed']),
  /** A camp mishap ruined tonight's rest. */
  noRecovery: z.boolean(),
  lastTown: IdSchema,
  members: z.array(MemberSaveSchema).min(1).max(8),
  /** PCs left at a tavern; any tavern can bring them back. */
  benched: z.array(MemberSaveSchema),
  /** The party's pooled crowns. */
  purse: z.number().min(0),
  /** Loot dice carried unrolled, one entry per die size. */
  loot: z.array(LootDiceSchema),
  /** Each visited town's spending and loot since its thresholds last reset. */
  towns: z.record(IdSchema, TownLedgerSchema),
  /** The day the economic climate last moved the purse. */
  climateDay: z.int().min(0),
  encounter: PendingEncounterSchema.nullable(),
  log: z.array(z.string()),
});
export type WorldSave = z.infer<typeof WorldSaveSchema>;
export type PendingEncounter = z.infer<typeof PendingEncounterSchema>;
