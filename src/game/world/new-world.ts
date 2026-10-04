// Starting a world: the chosen characters set out from the region's starting town.
import type { Character, DefaultPreset } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import { hexKey } from '../../rules/hex.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { startFactions } from '../factions/state.ts';
import { newMember, note } from './members.ts';
import { regionMap } from './region.ts';
import { enterTown, FULL_RATIONS } from './town.ts';
import { NO_LIGHT, type World } from './types.ts';

/** Six PCs; the two NPC slots come in Phase 6c (docs/rules-adaptation.md, Party and formation). */
export const MAX_PCS = 6;

export interface Recruit {
  character: Character;
  row: number;
  column: number;
  defaultAction: DefaultPreset;
}

export function newWorld(data: GameData, rng: Rng, party: Recruit[], regionId?: string): World {
  if (party.length === 0 || party.length > MAX_PCS) throw new Error('a party has one to six PCs');
  const map = regionMap(data, regionId ?? (data.content.regions[0] as { id: string }).id);
  const start = { col: map.start.col, row: map.start.row };
  const w: World = {
    region: map.id,
    rng,
    day: 0,
    quarter: 0,
    position: start,
    destination: null,
    visited: new Set([hexKey(start)]),
    elsewhere: {},
    rations: FULL_RATIONS,
    hikes: 0,
    camp: 'none',
    noRecovery: false,
    lastTown: map.start.id,
    members: party.map((p, i) => newMember(`m-${i}`, p)),
    benched: [],
    npcs: [],
    coach: null,
    arenaDay: null,
    quests: {},
    dungeon: null,
    light: { ...NO_LIGHT },
    rescues: [],
    raising: { offer: null, accepted: null },
    projects: [],
    workshops: [],
    components: {},
    countersigns: [],
    beaten: [],
    clock: 0,
    notes: {},
    ending: null,
    hirelingDays: { food: null, aid: null },
    deadShares: [],
    hireBans: {},
    ruins: {},
    caches: [],
    ordersEnded: [],
    authority: [],
    raid: null,
    raided: {},
    craftsmen: {},
    commissions: [],
    factions: {},
    purse: toTenths(party.reduce((sum, p) => sum + p.character.crowns, 0)),
    loot: [],
    towns: {},
    climateDay: 0,
    encounter: null,
    log: [],
  };
  startFactions(w, data);
  note(w, `The party gathers in ${map.start.name}.`);
  enterTown(w, data, map.start.id, true);
  return w;
}
