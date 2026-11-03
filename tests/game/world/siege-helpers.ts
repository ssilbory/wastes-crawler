// Shared fixtures for the siege tests (docs/rules-adaptation.md, Sieges).
import type { Siege, SiegeFight } from '../../../src/data/schemas/index.ts';
import { pickGoal } from '../../../src/game/factions/goals.ts';
import { beginSiege } from '../../../src/game/factions/siege.ts';
import { startFactions } from '../../../src/game/factions/state.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, world } from './helpers.ts';

export const LANTERNFALL = { col: 10, row: 4 };
export const HILLS = { col: 2, row: 2 };

/** The warhost's fighters camped before Lanternfall, the party where it is asked to stand. */
export function besieged(at = LANTERNFALL): { w: World; s: Siege } {
  const w = world();
  enterRegion(w, 'dark-lands', HILLS);
  w.position = { ...HILLS };
  startFactions(w, data);
  pickGoal(w, data, 'warhost', 0);
  for (const a of w.factions.warhost?.assets ?? []) a.at = 'lanternfall';
  const s = beginSiege(w, data, 'warhost', 'lanternfall', 'settlements');
  w.position = { ...at };
  w.rng = createRng('siege');
  return { w, s };
}

export const warhost = (w: World) => w.factions.warhost?.assets ?? [];
/** Only the warband left in the siege, so the simulated part has no one to fight. */
export const warbandOnly = (w: World) => {
  const s = w.factions.warhost;
  if (s) s.assets = s.assets.filter((a) => a.uid === 'a1' || a.at !== 'lanternfall');
};
/** The seeded stream, with the first roll fixed. */
export function firstRoll(face: number): World['rng'] {
  const rest = createRng('first');
  let used = false;
  return {
    ...rest,
    int: (min: number, max: number) => {
      if (used) return rest.int(min, max);
      used = true;
      return face;
    },
  };
}
export const asset = (w: World, uid: string) => warhost(w).find((a) => a.uid === uid);
export const fightOf = (s: Siege, uid: string, kind: SiegeFight['kind']): SiegeFight => ({
  town: s.town,
  attacker: s.attacker,
  uid,
  kind,
});
export const won = (siege: SiegeFight) =>
  ({ kind: 'fight-won', quest: null, garrison: null, siege }) as const;

/** Content whose settlements raise no militia, so an undefended assault is lost at once. */
export const bare = {
  ...data,
  content: {
    ...data.content,
    siegeRules: { ...data.content.siegeRules, militia: { village: 0, town: 0, city: 0 } },
  },
};
export const undefended = (w: World) => {
  const free = w.factions.settlements;
  if (!free) throw new Error('no settlements');
  free.assets = free.assets.filter((a) => a.at !== 'lanternfall');
};
