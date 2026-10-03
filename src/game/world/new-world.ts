// Starting a world: the chosen characters set out from the region's starting town.
import type { Character, DefaultPreset } from '../../data/schemas/index.ts';
import { hexKey } from '../../rules/hex.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { note } from './members.ts';
import { regionMap } from './region.ts';
import { enterTown, FULL_RATIONS } from './town.ts';
import type { World } from './types.ts';

export interface Recruit {
  character: Character;
  row: number;
  column: number;
  defaultAction: DefaultPreset;
}

export function newWorld(data: GameData, rng: Rng, party: Recruit[], regionId?: string): World {
  if (party.length === 0 || party.length > 8) throw new Error('a party has one to eight members');
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
    rations: FULL_RATIONS,
    hikes: 0,
    camp: 'none',
    noRecovery: false,
    lastTown: map.start.id,
    members: party.map((p, i) => ({
      id: `m-${i}`,
      character: p.character,
      row: p.row,
      column: p.column,
      defaultAction: p.defaultAction,
      dead: false,
      frail: false,
      hungry: false,
      sleepless: false,
      cold: false,
      slept: false,
      spellsCast: 0,
      effortDay: 0,
    })),
    encounter: null,
    log: [],
  };
  note(w, `The party gathers in ${map.start.name}.`);
  enterTown(w, data, map.start.id);
  return w;
}
