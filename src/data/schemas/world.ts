import { z } from 'zod';
import { IdSchema } from './common.ts';
import { DefaultPresetSchema } from './roster.ts';
import { CharacterSchema } from './character.ts';
import { CellSchema, FacingSchema } from './dungeon-content.ts';
import { LootDiceSchema } from './town-content.ts';

export const WORLD_SCHEMA_VERSION = 6;

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

/** A hireling or a freed captive in one of the party's NPC slots (docs/rules-adaptation.md). */
export const NpcSaveSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(['hireling', 'captive', 'escort']),
  /** The hireling type, captive id, or escort quest id. */
  type: IdSchema,
  name: z.string().min(1),
  hp: z.int().min(0),
  maxHp: z.int().min(1),
  row: z.int().min(0).max(1),
  column: z.int().min(0).max(3),
  /** Failed a Morale check: leaves at the next town. */
  quitting: z.boolean(),
  /** A porter's load. */
  inventory: CharacterSchema.shape.inventory,
});
export type NpcSave = z.infer<typeof NpcSaveSchema>;

export const ReactionSchema = z.enum([
  'aggressive',
  'unfriendly',
  'expected',
  'friendly',
  'helpful',
]);

export const PendingEncounterSchema = z.strictObject({
  enemies: z.array(z.array(IdSchema)).min(1).max(3),
  nature: z.enum(['hostile', 'wary']),
  /** The group's mood, moved by parley (SRD 5.2.1). */
  reaction: ReactionSchema,
  /** The party has tried its one parley. */
  parleyed: z.boolean(),
  /** A captive they hold, or null. */
  captive: IdSchema.nullable(),
  /** The quest whose fixed encounter this is, or null for a wandering one. */
  quest: IdSchema.nullable(),
  /** A hireling type one of them offers to sign on as, after a helpful parley. */
  offer: IdSchema.nullable(),
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

/** A quest taken (docs/rules-adaptation.md, Quests in Phase 6): the step in progress. */
export const QuestStateSchema = z.strictObject({
  status: z.enum(['active', 'ready', 'done', 'failed']),
  step: z.int().min(0),
  acceptedDay: z.int().min(0),
});
export type QuestState = z.infer<typeof QuestStateSchema>;

/** A coach journey under way: the road hexes still ahead, and the last day checked for ambush. */
export const CoachTripSchema = z.strictObject({
  route: IdSchema,
  to: IdSchema,
  path: z.array(HexSchema),
  checkedDay: z.int().min(0).nullable(),
});
export type CoachTrip = z.infer<typeof CoachTripSchema>;

/** The party underground: where it stands, which way it faces, and the cells it has seen. */
export const DungeonStateSchema = z.strictObject({
  dungeon: IdSchema,
  level: IdSchema,
  at: CellSchema,
  facing: FacingSchema,
  /** Seen cells ("x,y") by level, for the automap. */
  seen: z.record(IdSchema, z.array(z.string())),
});
export type DungeonState = z.infer<typeof DungeonStateSchema>;

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
  /** Hirelings and captives in the NPC slots. */
  npcs: z.array(NpcSaveSchema).max(2),
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
  /** A coach journey under way. */
  coach: CoachTripSchema.nullable(),
  /** The day of the party's last arena bout. */
  arenaDay: z.int().min(0).nullable(),
  /** Every quest taken, by id. */
  quests: z.record(IdSchema, QuestStateSchema),
  /** The party's place in a dungeon, or null on the surface. */
  dungeon: DungeonStateSchema.nullable(),
  log: z.array(z.string()),
});
export type WorldSave = z.infer<typeof WorldSaveSchema>;
export type PendingEncounter = z.infer<typeof PendingEncounterSchema>;
