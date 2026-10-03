// The overland world state the game layer mutates. Saves turn it into WorldSave (save.ts).
import type {
  Character,
  DefaultPreset,
  PendingEncounter,
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
}

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
  encounter: PendingEncounter | null;
  log: string[];
}

/** What a member does in a camp quarter (docs/rules-adaptation.md, Overland travel). */
export type Activity = 'rest' | 'sleep' | 'forage' | 'hunt' | 'make-camp' | 'watch';

export type QuarterPlan =
  | { kind: 'hike'; leader: string | null; watcher: string | null }
  | { kind: 'camp'; activities: Record<string, Activity> };
