import { z } from 'zod';
import { ElementSchema, IdSchema } from './common.ts';
import { DefaultPresetSchema } from './roster.ts';
import { CharacterSchema } from './character.ts';
import { CellSchema, FacingSchema } from './dungeon-content.ts';
import { FactionStateSchema } from './faction-content.ts';
import { LootDiceSchema } from './town-content.ts';

export const WORLD_SCHEMA_VERSION = 31;

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
  /** Spell points spent since the last night's recovery: the Invoker's (1.5.11). */
  pointsSpent: z.int().min(0),
  /** The Skinshifter's alternate form worn now, by index, until night or ended (1.5.15). */
  form: z.int().min(0).nullable(),
  effortDay: z.int().min(0),
  /** XP won while dead, granted when raised. */
  pendingXp: z.number().min(0).multipleOf(0.5),
  /** Revived by a Healer and unconscious until the next night passes (Phase 14d). */
  reviving: z.boolean(),
  /** Uses of limited arts since the last quarter of rest, by art id (Phase 15). */
  artUses: z.record(IdSchema, z.int().min(0)),
  /** The day of the member's last prayer at a temple or mortuary. */
  prayedDay: z.int().min(0).nullable(),
  /** Healers who have tried Purge Ailment on this Frailty, by member id: one try each. */
  purgeTries: z.array(z.string().min(1)),
});

/** A hireling or a freed captive in one of the party's NPC slots (docs/rules-adaptation.md). */
export const NpcSaveSchema = z.strictObject({
  id: z.string().min(1),
  kind: z.enum(['hireling', 'captive', 'escort', 'undead', 'beast', 'summon', 'tree']),
  /**
   * The hireling type, captive id, escort quest id, or the monster id of an undead servant, a
   * beast, a summoned servant (gone at dawn, Phase 18a), or a woken tree.
   */
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
  /** A hireling's share of loot taken since the party was last in town, in crowns (Phase 12). */
  owed: z.number().min(0),
  /** Crowns of the signing fee returned if they are let go alive in a settlement. */
  refund: z.number().min(0),
  /** Who an undead servant, a beast, a summoned servant, or a tree answers to, by member id. */
  master: z.string().optional(),
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
  /** A beast that offers to follow a handler with Animal Ken, after a helpful parley. */
  beast: IdSchema.optional(),
  /** True when the group means to fight. */
  hostile: z.boolean(),
  /** The party spotted them first and can slip away. */
  spotted: z.boolean(),
  text: z.string(),
  /** A bound garrison's or patrol's standing order (Phase 12b). */
  order: IdSchema.optional(),
  /** The garrison post (Phase 12c) or grove this group holds, by key, so a won fight clears it. */
  garrison: z.string().optional(),
  /** The faction asset this patrol belongs to, as faction:uid (Phase 13b). */
  patrol: z.string().optional(),
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

/** An item being crafted (docs/rules-adaptation.md, Crafting and modifying gear). */
export const ProjectSchema = z.strictObject({
  /** The member doing the work; each works on one thing at a time. */
  crafter: z.string().min(1),
  /** Building gear, installing a mod, or stripping one off (Phase 10b). */
  kind: z.enum(['gear', 'mod', 'strip']),
  /** The item built, or the item a mod goes on or comes off. */
  item: IdSchema,
  mod: IdSchema.optional(),
  /** The serial of the inventory line a mod goes on or comes off. */
  target: z.string().min(1).optional(),
  /** The components a mod being installed has used up. */
  components: z.array(IdSchema).optional(),
  quality: z.enum(['jury-rigged', 'normal', 'mastercrafted']),
  small: z.literal(true).optional(),
  daysLeft: z.int().min(1),
  /** The town where the parts were bought. */
  town: IdSchema,
  /** The crafter stayed behind at that town's workshop to finish it. */
  staying: z.boolean(),
});
export type Project = z.infer<typeof ProjectSchema>;

/** A craftsman's month: trade pool left, magic weapons and components for sale. */
export const CraftsmanStateSchema = z.strictObject({
  since: z.int().min(0),
  pool: z.number().min(0),
  stock: z.array(z.strictObject({ weapon: IdSchema, bonus: z.int().min(1).max(3) })),
  parts: z.record(IdSchema, z.int().min(1)),
});
export type CraftsmanState = z.infer<typeof CraftsmanStateSchema>;

/** A magic weapon commissioned from a craftsman, collected in their town once ready. */
export const CommissionSchema = z.strictObject({
  craftsman: IdSchema,
  weapon: IdSchema,
  bonus: z.int().min(1).max(3),
  readyDay: z.int().min(0),
});
export type Commission = z.infer<typeof CommissionSchema>;

/** Raising quests (docs/rules-adaptation.md, Raising quests). */
export const RaisingSchema = z.strictObject({
  offer: IdSchema.nullable(),
  accepted: z.int().min(0).nullable(),
});
export type Raising = z.infer<typeof RaisingSchema>;

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
  /** Exploration turns since the party came down (SRD 2.13.2). */
  turn: z.int().min(0),
  /** Steps toward the next turn: 12 make one. */
  steps: z.int().min(0),
  /** Secret door edges ("x,y,n" or "x,y,w") found, by level. */
  found: z.record(IdSchema, z.array(z.string())),
  /** Walls dug through with The Burrower Below, by level, keyed as `found` is. */
  dug: z.record(IdSchema, z.array(z.string())),
  /** Secret door edges the party has had its free look at, by level. */
  glimpsed: z.record(IdSchema, z.array(z.string())),
  /** Traps the party knows of or has disarmed, by level and cell. */
  traps: z.record(IdSchema, z.record(z.string(), z.enum(['noticed', 'disarmed']))),
  /** Message squares already read, by level. */
  read: z.record(IdSchema, z.array(z.string())),
  /** Apprehending the Arcane Form: whose sight it is, and the turn it fades. */
  sight: z.strictObject({ member: z.string().min(1), until: z.int().min(0) }).nullable(),
  /** Magical squares the party has sensed with it, by level, as "x,y". */
  sensed: z.record(IdSchema, z.array(z.string())),
});
export type DungeonState = z.infer<typeof DungeonStateSchema>;

const ResourceDieSchema = z.union([0, 4, 6, 8, 10, 12].map((n) => z.literal(n)));

/** The party's light (docs/rules-adaptation.md, Resource dice and Dungeon exploration). */
export const LightSchema = z.strictObject({
  /** What is burning, if anything. */
  lit: z.enum(['torch', 'lantern']).nullable(),
  /** The die of the torch in hand, 0 for none. */
  torch: ResourceDieSchema,
  /** The oil left in the party's lantern. */
  lantern: ResourceDieSchema,
  /** Torches drawn from Dungeoneering Kits and not yet burned. */
  kitTorches: z.int().min(0),
  /** The kits have been restocked in town since they were last drawn on. */
  kitsReady: z.boolean(),
});
export type Light = z.infer<typeof LightSchema>;

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
  /** Explored hexes of the regions the party isn't in, by region (Phase 12). */
  elsewhere: z.record(IdSchema, z.array(z.string())),
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
  light: LightSchema,
  /** Dungeon captives freed, as "dungeon/level/x,y": each rescue happens once per world. */
  rescues: z.array(z.string()),
  /** The raising quest on offer, and the day one was last taken (once a month). */
  raising: RaisingSchema,
  /** Crafting under way. */
  projects: z.array(ProjectSchema),
  /** Towns whose workshop the party owns. */
  workshops: z.array(IdSchema),
  /** Crafting components carried, by id; like loot dice they weigh nothing. */
  components: z.record(IdSchema, z.int().min(1)),
  /** Standing orders whose countersigns the party knows, and those it has ended (Phase 12b). */
  countersigns: z.array(IdSchema),
  ordersEnded: z.array(IdSchema),
  /** Garrison posts the party has beaten, by key (Phase 12c). */
  beaten: z.array(z.string()),
  /** The warlord's clock, in segments (Phase 12d). */
  clock: z.int().min(0),
  /** Crafter's notes found, by set, and what became of them. */
  notes: z.record(IdSchema, z.enum(['found', 'burned', 'sold', 'kept', 'paid'])),
  /** The day a guide last found food and a physician last gave strain-free first aid. */
  hirelingDays: z.strictObject({ food: z.int().nullable(), aid: z.int().nullable() }),
  /** Dead hirelings whose shares the party has yet to pay or refuse. */
  deadShares: z.array(z.strictObject({ name: z.string().min(1), owed: z.number().min(0) })),
  /** Towns that won't hire for the party, and the day they relent. */
  hireBans: z.record(IdSchema, z.int().min(0)),
  /** Ruins generated so far: each one's layout seed, and the day its vault was emptied (Phase 12e). */
  ruins: z.record(
    IdSchema,
    z.strictObject({ seed: z.int().min(1), emptied: z.int().min(0).nullable() }),
  ),
  /** Loot caches taken, by dungeon, level, and cell. */
  caches: z.array(z.string()),
  /** Dungeons and ruins whose way down a tavern rumor has told the party of, by id. */
  rumors: z.array(IdSchema),
  /** What the party did with the Seal of Command, once decided. */
  ending: z.enum(['destroy', 'give', 'keep']).nullable(),
  /** Tokens of command authority the party carries. */
  authority: z.array(IdSchema),
  /** The settlement raiders mean to hit, the day they strike, and whether the party is fighting them. */
  raid: z
    .strictObject({
      town: IdSchema,
      day: z.int().min(0),
      fighting: z.boolean(),
      /** The raiding faction's asset that leads it (Phase 13b). */
      asset: z.string().optional(),
    })
    .nullable(),
  /** Raided settlements and the day their prices recover. */
  raided: z.record(IdSchema, z.int().min(0)),
  /** Each craftsman's month, by id, once the party has visited. */
  craftsmen: z.record(IdSchema, CraftsmanStateSchema),
  commissions: z.array(CommissionSchema),
  /**
   * Corpses left by the party's last won fight, as each one's hit dice, and where they lie: a hex
   * key above ground, or dungeon/level/cell below (Phase 14b).
   */
  corpses: z
    .strictObject({
      at: z.string(),
      hitDice: z.array(z.int().min(1)),
      /** The day the latest of them fell; Query the Skull reaches back a day per caster level. */
      day: z.int().min(0),
      /** Query the Skull has been cast on them (it may not be cast twice on the same corpse). */
      queried: z.boolean(),
    })
    .nullable(),
  /**
   * Members slain in the party's last fight, and where it was fought: a Healer can revive them
   * there before the party moves on or the day ends (Phase 14d).
   */
  fallen: z.strictObject({ at: z.string(), members: z.array(z.string()) }).nullable(),
  /** The day a member last played the inn's common room for the party's lodging. */
  performedDay: z.int().min(0).nullable(),
  /** Monsters the party has named with Know, whose statistics it can see. */
  bestiary: z.array(IdSchema),
  /** Each faction's state, by id, once it has started (Phase 13). */
  factions: z.record(IdSchema, FactionStateSchema),
  /** Adopt the Simulacular Visage: the day it was cast, and who wears the seeming. */
  disguise: z.strictObject({ day: z.int().min(0), ids: z.array(z.string()) }).nullable(),
  /** The Jade Palanquin: the quarter, counted from the world's start, at which it fades. */
  palanquin: z.int().min(0).nullable(),
  /**
   * Pact of Stone and Sea: where (a dungeon level, or the surface) and on what day the pacts were
   * made, and each pacted member's element.
   */
  pacts: z
    .strictObject({
      at: z.string().min(1),
      day: z.int().min(0),
      by: z.record(z.string(), ElementSchema),
    })
    .nullable(),
  log: z.array(z.string()),
});
export type WorldSave = z.infer<typeof WorldSaveSchema>;
export type PendingEncounter = z.infer<typeof PendingEncounterSchema>;

/** A full game save (docs/plan.md, Phase 11): the world and the character roster in one file. */
export const SAVE_BUNDLE_KIND = 'wastes-crawler-save';
export const SaveBundleSchema = z.strictObject({
  kind: z.literal(SAVE_BUNDLE_KIND),
  version: z.literal(1),
  /** A world save, checked by its own schema and migrations. */
  world: z.unknown(),
  /** A stored roster, checked by its own schema. */
  roster: z.unknown(),
});
export type SaveBundle = z.infer<typeof SaveBundleSchema>;
