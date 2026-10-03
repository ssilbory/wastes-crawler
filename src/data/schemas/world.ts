import { z } from 'zod';
import { IdSchema } from './common.ts';
import { DefaultPresetSchema } from './roster.ts';

export const WORLD_SCHEMA_VERSION = 1;

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
});

export const PendingEncounterSchema = z.strictObject({
  enemies: z.array(z.array(IdSchema)).min(1).max(3),
  /** True when the group means to fight. */
  hostile: z.boolean(),
  /** The party spotted them first and can slip away. */
  spotted: z.boolean(),
  text: z.string(),
});

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
  encounter: PendingEncounterSchema.nullable(),
  log: z.array(z.string()),
});
export type WorldSave = z.infer<typeof WorldSaveSchema>;
export type PendingEncounter = z.infer<typeof PendingEncounterSchema>;
