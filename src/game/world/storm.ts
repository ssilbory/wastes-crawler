// Storming a held settlement (Phase 23b; Sam's call: the party may retake a town alone). In a
// settlement of the ally's that a rival holds, the party fights the holder's sturdiest asset there
// as its patrol group, and once none is left, the base's guard: one militia per hit point of the
// base, up to 8. A win destroys the asset or razes the base; with the holder's base gone the ally
// takes the settlement back (src/game/factions/capture.ts), and the party earns Renown for it.
// Storming joins any siege the ally has laid there.
import type { FactionState, SiegeFight } from '../../data/schemas/index.ts';
import { groupOf, mergeGroups, toRows } from '../factions/assault.ts';
import { reclaim } from '../factions/capture.ts';
import { hurtAsset, hurtBase } from '../factions/combat.ts';
import { settle } from '../factions/siege.ts';
import { assetName, factionOf, locationName } from '../factions/state.ts';
import type { GameData } from '../character/context.ts';
import { meetGroup } from './encounters.ts';
import type { TownResult } from './services.ts';
import { holderOf, partyIn, partySide } from './siege-state.ts';
import { currentTown } from './town-prices.ts';
import type { World } from './types.ts';

export interface StormTarget {
  town: string;
  holder: string;
  /** The holder's asset the party faces, or `base` for the base's guard. */
  uid: string;
  name: string;
  rows: string[][];
  /** The base's guard fighting beside the asset when the party storms (Phase 23g), or none. */
  guard?: number;
}

/**
 * The holder's sturdiest asset in a town as its patrol group, or, with none there, its base's
 * guard: a militia per base hit point, up to 8. The party faces it storming the town, or in an
 * assault fought on the besiegers' side (sieges.ts).
 */
export function holdTarget(
  w: World,
  data: GameData,
  town: string,
  holder: string,
  withGuard = false,
): StormTarget {
  // Only a standing faction with a base here holds a town.
  const s = w.factions[holder] as FactionState;
  const here = s.assets.filter((a) => a.at === town);
  const who = factionOf(data, holder).name;
  const guard = Math.min(8, ...s.bases.filter((b) => b.at === town).map((b) => b.hp));
  const militia = toRows(
    Array.from({ length: guard }, () => data.content.siegeRules.militiaMonster),
  );
  if (here.length > 0) {
    const held = here.reduce((a, b) => (b.hp > a.hp ? b : a));
    const group = groupOf(data, holder, held);
    const asset = `${who}'s ${assetName(data, holder, held.asset)}`;
    // Sam's call (Phase 23g): a storm meets the base's guard beside the asset.
    if (withGuard && data.content.siegeRules.stormGuard)
      return {
        town,
        holder,
        uid: held.uid,
        name: `${asset} and the guard`,
        rows: mergeGroups([group, militia]),
        guard,
      };
    return { town, holder, uid: held.uid, name: asset, rows: group };
  }
  return {
    town,
    holder,
    uid: 'base',
    name: `${who}'s hold on ${locationName(data, town)}`,
    rows: militia,
  };
}

/** Whom the party would fight storming the settlement it stands in, if a rival holds it. */
export function stormTarget(w: World, data: GameData): StormTarget | null {
  const town = w.dungeon ? undefined : currentTown(w, data);
  const holder = town && partyIn(w, data, town.id) ? holderOf(w, data, town.id) : null;
  return town && holder ? holdTarget(w, data, town.id, holder, true) : null;
}

/** The party storms the holder's sturdiest asset in town, or its base's guard. */
export function storm(w: World, data: GameData): TownResult {
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  const t = stormTarget(w, data);
  if (!t) return { ok: false, reason: 'No rival holds this town.' };
  // Storming the town fights in any siege of it the party is on the besiegers' side of.
  for (const s of w.sieges.filter((x) => x.town === t.town && partySide(data, x) === 'attacker')) {
    s.joined = true;
    s.next = Math.min(s.next, w.day);
  }
  const e = meetGroup(w, data, t.rows, 'hostile', null, null, `The party storms ${t.name}!`);
  e.siege = { town: t.town, attacker: t.holder, uid: t.uid, kind: 'storm' };
  if (t.guard) e.siege.guard = t.guard;
  return { ok: true };
}

/** A storm won: the asset destroyed or the base razed, and the town taken back once it is free. */
export function stormWon(w: World, data: GameData, f: SiegeFight): void {
  const s = w.factions[f.attacker];
  const held = s?.assets.find((a) => a.uid === f.uid);
  if (held) hurtAsset(w, data, f.attacker, held, held.hp);
  const base = s?.bases.find((b) => b.at === f.town);
  // The guard beaten costs the base a hit point each; the guard alone, the whole base.
  const toll = f.uid === 'base' ? base?.hp : f.guard;
  if (base && toll) hurtBase(w, data, f.attacker, f.town, toll);
  // A siege the ally laid there ends with the holder gone, and pays for the party's part in it.
  for (const siege of w.sieges.filter((x) => x.town === f.town)) settle(w, data, siege);
  reclaim(w, data, f.town, true);
}
