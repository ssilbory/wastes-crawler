import type { FactionState } from '../../../src/data/schemas/index.ts';
import { startFactions } from '../../../src/game/factions/state.ts';
import type { World } from '../../../src/game/world/types.ts';
import { data, world } from '../world/helpers.ts';

export { data };

/** A new world with every faction at its start. */
export function factionWorld(): World {
  const w = world();
  startFactions(w, data);
  return w;
}

export function faction(w: World, id: string): FactionState {
  const s = w.factions[id];
  if (!s) throw new Error(`no faction ${id}`);
  return s;
}

/** The faction's first asset of a kind. */
export function held(w: World, id: string, asset: string) {
  const a = faction(w, id).assets.find((x) => x.asset === asset);
  if (!a) throw new Error(`${id} holds no ${asset}`);
  return a;
}
