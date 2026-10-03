// The overland world state the game layer mutates. Saves turn it into WorldSave (save.ts).
import type {
  Character,
  CoachTrip,
  DungeonState,
  Light,
  DefaultPreset,
  LootDice,
  NpcSave,
  PendingEncounter,
  QuestState,
  Project,
  Raising,
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
  effortDay: number;
  pendingXp: number;
}

export type Npc = NpcSave;

export interface World {
  region: string;
  rng: Rng;
  day: number;
  quarter: number;
  position: Hex;
  destination: Hex | null;
  visited: Set<string>;
  rations: ResourceDie;
  hikes: number;
  camp: WorldSave['camp'];
  noRecovery: boolean;
  lastTown: string;
  members: Member[];
  benched: Member[];
  npcs: Npc[];
  purse: number;
  loot: LootDice[];
  towns: Record<string, TownLedger>;
  climateDay: number;
  encounter: PendingEncounter | null;
  coach: CoachTrip | null;
  arenaDay: number | null;
  quests: Record<string, QuestState>;
  dungeon: DungeonState | null;
  light: Omit<Light, 'torch' | 'lantern'> & { torch: ResourceDie; lantern: ResourceDie };
  rescues: string[];
  raising: Raising;
  projects: Project[];
  workshops: string[];
  components: Record<string, number>;
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
export type Activity = 'rest' | 'sleep' | 'forage' | 'hunt' | 'make-camp' | 'watch';

export type QuarterPlan =
  | { kind: 'hike'; leader: string | null; watcher: string | null }
  | { kind: 'camp'; activities: Record<string, Activity> };
