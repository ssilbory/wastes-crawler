// Starting a world: the chosen characters set out from the region's starting town.
import type { Character, DefaultPreset, Region } from '../../data/schemas/index.ts';
import { toTenths } from '../../rules/economy.ts';
import { hexKey } from '../../rules/hex.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { startFactions } from '../factions/state.ts';
import { newMember, note } from './members.ts';
import { isCampaign, regionMap, withWorldMap } from './region.ts';
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

/**
 * A new world. With `custom`, a map from the map editor, or `realm`, a shipped realm, the party
 * starts in that map's or the realm's starting town and the campaign's factions stay out of it
 * (Sam's call: custom maps and realms have no campaign story).
 */
export function newWorld(
  campaignData: GameData,
  rng: Rng,
  party: Recruit[],
  regionId?: string,
  custom: Region | null = null,
  realm: string | null = null,
): World {
  if (party.length === 0 || party.length > MAX_PCS) throw new Error('a party has one to six PCs');
  const data = withWorldMap(campaignData, custom);
  const realmStart = realm ? data.content.realms.find((r) => r.id === realm)?.start : undefined;
  if (realm && !realmStart) throw new Error(`unknown realm ${realm}`);
  const map = regionMap(
    data,
    custom?.id ?? realmStart ?? regionId ?? (data.content.regions[0] as { id: string }).id,
  );
  const start = { col: map.start.col, row: map.start.row };
  const w: World = {
    region: map.id,
    map: custom,
    realm: custom ? null : realm,
    rng,
    day: 0,
    quarter: 0,
    position: start,
    destination: null,
    visited: new Set([hexKey(start)]),
    elsewhere: {},
    routes: {},
    rations: FULL_RATIONS,
    hikes: 0,
    camp: 'none',
    noRecovery: false,
    lastTown: map.start.id,
    members: party.map((p, i) => newMember(`m-${i}`, p)),
    benched: [],
    npcs: [],
    mounts: [],
    coach: null,
    arenaDay: null,
    quests: {},
    dungeon: null,
    charted: {},
    light: { ...NO_LIGHT },
    rescues: [],
    raising: { offer: null, accepted: null },
    projects: [],
    workshops: [],
    components: {},
    countersigns: [],
    beaten: [],
    pieces: [],
    warlords: [],
    clock: 0,
    notes: {},
    ending: null,
    hirelingDays: { food: null, aid: null },
    deadShares: [],
    hireBans: {},
    ruins: {},
    caches: [],
    rumors: [],
    ordersEnded: [],
    authority: [],
    raid: null,
    raided: {},
    craftsmen: {},
    commissions: [],
    alchemists: {},
    brewOrders: [],
    corpses: null,
    fallen: null,
    performedDay: null,
    bestiary: [],
    disguise: null,
    palanquin: null,
    pacts: null,
    factions: {},
    purse: toTenths(party.reduce((sum, p) => sum + p.character.crowns, 0)),
    loot: [],
    towns: {},
    climateDay: 0,
    encounter: null,
    log: [],
  };
  if (isCampaign(w)) startFactions(w, data);
  note(w, `The party gathers in ${map.start.name}.`);
  enterTown(w, data, map.start.id, true);
  return w;
}
