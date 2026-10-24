// The overland world state the game layer mutates. Saves turn it into WorldSave (save.ts).
import type {
  Character,
  CoachTrip,
  DungeonChart,
  DungeonState,
  Light,
  DefaultPreset,
  LootDice,
  MountSave,
  NpcSave,
  PendingEncounter,
  QuestState,
  Project,
  AlchemistState,
  BrewOrder,
  Commission,
  CraftsmanState,
  FactionState,
  Raising,
  Region,
  TownLedger,
  WorldSave,
} from '../../data/schemas/index.ts';
import type { Hex } from '../../rules/hex.ts';
import type { ResourceDie } from '../../rules/resource-die.ts';
import type { Rng } from '../../rules/rng.ts';

export interface Member {
  id: string;
  character: Character;
  row: number;
  column: number;
  defaultAction: DefaultPreset;
  dead: boolean;
  frail: boolean;
  hungry: boolean;
  sleepless: boolean;
  cold: boolean;
  slept: boolean;
  spellsCast: number;
  pointsSpent: number;
  form: number | null;
  effortDay: number;
  pendingXp: number;
  reviving: boolean;
  artUses: Record<string, number>;
  prayedDay: number | null;
  /** A Beastmaster's companion sent away, ready to be called (1.5.4). */
  companion: NpcSave | null;
  /** Hit points Feral Toughness adds to the maximum now (1.5.4). */
  toughness: number;
  purgeTries: string[];
  poisoned: boolean;
  disease: { id: string; nights: number; saves: number } | null;
}

export type Npc = NpcSave;
export type Mount = MountSave;

export interface World {
  region: string;
  /** A custom map from the map editor the world is played on, or null for the campaign. */
  map: Region | null;
  /** The shipped realm the world is played on, or null for the campaign or a custom map. */
  realm: string | null;
  rng: Rng;
  day: number;
  quarter: number;
  position: Hex;
  destination: Hex | null;
  visited: Set<string>;
  elsewhere: Record<string, string[]>;
  /** Hexes shown on the trade-route maps bought, by region. */
  routes: Record<string, string[]>;
  rations: ResourceDie;
  hikes: number;
  camp: WorldSave['camp'];
  noRecovery: boolean;
  lastTown: string;
  members: Member[];
  benched: Member[];
  npcs: Npc[];
  mounts: Mount[];
  purse: number;
  loot: LootDice[];
  towns: Record<string, TownLedger>;
  climateDay: number;
  encounter: PendingEncounter | null;
  coach: CoachTrip | null;
  arenaDay: number | null;
  quests: Record<string, QuestState>;
  dungeon: DungeonState | null;
  /** The party's maps of dungeons it has left, by dungeon id (dungeon/chart.ts). */
  charted: Record<string, DungeonChart>;
  light: Omit<Light, 'torch' | 'lantern'> & { torch: ResourceDie; lantern: ResourceDie };
  rescues: string[];
  raising: Raising;
  projects: Project[];
  workshops: string[];
  components: Record<string, number>;
  countersigns: string[];
  /** Garrison posts beaten in a fight, by key (orders.ts). */
  beaten: string[];
  /** Pieces of countersigns found, by "<order>:<cell key>" (specials.ts). */
  pieces: string[];
  /** The Wastes warlords fallen, by id (warlords.ts). */
  warlords: string[];
  /** The warlord's clock, crafter's notes, and the seal's fate (Phase 12d). */
  clock: number;
  notes: Record<string, 'found' | 'burned' | 'sold' | 'kept' | 'paid'>;
  ending: 'destroy' | 'give' | 'keep' | null;
  /** The day a guide last found food and a physician last gave strain-free first aid. */
  hirelingDays: { food: number | null; aid: number | null };
  deadShares: { name: string; owed: number }[];
  hireBans: Record<string, number>;
  /** Generated ruins and taken loot caches (Phase 12e). */
  ruins: Record<string, { seed: number; emptied: number | null }>;
  caches: string[];
  /** Ways down a tavern rumor has told the party of, by dungeon or ruin id. */
  rumors: string[];
  ordersEnded: string[];
  authority: string[];
  raid: WorldSave['raid'];
  raided: Record<string, number>;
  craftsmen: Record<string, CraftsmanState>;
  commissions: Commission[];
  alchemists: Record<string, AlchemistState>;
  brewOrders: BrewOrder[];
  /** Corpses lying where the last won fight was (Phase 14b). */
  corpses: WorldSave['corpses'];
  fallen: WorldSave['fallen'];
  performedDay: number | null;
  bestiary: string[];
  /** Faction state by id (Phase 13). */
  factions: Record<string, FactionState>;
  /** Adopt the Simulacular Visage, until the next dawn. */
  disguise: WorldSave['disguise'];
  /** When the Jade Palanquin fades, as a quarter counted from the world's start. */
  palanquin: number | null;
  /** Pact of Stone and Sea, for the rest of the scene. */
  pacts: WorldSave['pacts'];
  log: string[];
}

/** No light burning, nothing left in hand, and the kits ready to draw on. */
export const NO_LIGHT: World['light'] = {
  lit: null,
  torch: 0,
  lantern: 0,
  kitTorches: 0,
  kitsReady: true,
};

/** What a member does in a camp quarter (docs/rules-adaptation.md, Overland travel). */
export type Activity =
  'rest' | 'sleep' | 'forage' | 'hunt' | 'firewood' | 'make-camp' | 'watch' | 'craft';

export type QuarterPlan =
  | { kind: 'hike'; leader: string | null; watcher: string | null }
  | { kind: 'camp'; activities: Record<string, Activity> };
