// Storming a held settlement (Phase 23b; Sam's call: the party may retake a town alone). In a
// settlement of the ally's that a rival holds, the party fights the holder's sturdiest asset there
// as its patrol group, and once none is left, the base's guard: one militia per hit point of the
// base, up to 8. A win destroys the asset or razes the base; with the holder's base gone the ally
// takes the settlement back (src/game/factions/capture.ts), and the party earns Renown for it.
// Storming joins any siege the ally has laid there.
import type { FactionState, SiegeFight } from '../../data/schemas/index.ts';
import { groupOf, toRows } from '../factions/assault.ts';
import { reclaim, retaken } from '../factions/capture.ts';
import { hurtAsset, hurtBase } from '../factions/combat.ts';
import { settle } from '../factions/siege.ts';
import { assetName, factionOf } from '../factions/state.ts';
import type { GameData } from '../character/context.ts';
import { meetGroup } from './encounters.ts';
import type { TownResult } from './services.ts';
import { holderOf, partyIn } from './siege-state.ts';
import { currentTown } from './town-prices.ts';
import type { World } from './types.ts';

export interface StormTarget {
  town: string;
  holder: string;
  /** The holder's asset the party faces, or `base` for the base's guard. */
  uid: string;
  name: string;
  rows: string[][];
}

/** Whom the party would fight storming the settlement it stands in, if a rival holds it. */
export function stormTarget(w: World, data: GameData): StormTarget | null {
  const town = w.dungeon ? undefined : currentTown(w, data);
  const holder = town && partyIn(w, data, town.id) ? holderOf(w, data, town.id) : null;
  if (!town || !holder) return null;
  // holderOf names only a standing faction with a base here.
  const s = w.factions[holder] as FactionState;
  const here = s.assets.filter((a) => a.at === town.id);
  const who = factionOf(data, holder).name;
  if (here.length > 0) {
    const held = here.reduce((a, b) => (b.hp > a.hp ? b : a));
    return {
      town: town.id,
      holder,
      uid: held.uid,
      name: `${who}'s ${assetName(data, holder, held.asset)}`,
      rows: groupOf(data, holder, held),
    };
  }
  const guard = Math.min(8, ...s.bases.filter((b) => b.at === town.id).map((b) => b.hp));
  return {
    town: town.id,
    holder,
    uid: 'base',
    name: `${who}'s hold on ${town.name}`,
    rows: toRows(Array.from({ length: guard }, () => data.content.siegeRules.militiaMonster)),
  };
}

/** The party storms the holder's sturdiest asset in town, or its base's guard. */
export function storm(w: World, data: GameData): TownResult {
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  const t = stormTarget(w, data);
  if (!t) return { ok: false, reason: 'No rival holds this town.' };
  // Storming the town fights the ally's siege of it, if one is laid.
  for (const s of w.sieges.filter((x) => x.town === t.town)) {
    s.joined = true;
    s.next = Math.min(s.next, w.day);
  }
  const e = meetGroup(w, data, t.rows, 'hostile', null, null, `The party storms ${t.name}!`);
  e.siege = { town: t.town, attacker: t.holder, uid: t.uid, kind: 'storm' };
  return { ok: true };
}

/** A storm won: the asset destroyed or the base razed, and the town taken back once it is free. */
export function stormWon(w: World, data: GameData, f: SiegeFight): void {
  const s = w.factions[f.attacker];
  const held = s?.assets.find((a) => a.uid === f.uid);
  if (held) hurtAsset(w, data, f.attacker, held, held.hp);
  const base = f.uid === 'base' ? s?.bases.find((b) => b.at === f.town) : undefined;
  if (base) hurtBase(w, data, f.attacker, f.town, base.hp);
  // A siege the ally laid there ends with the holder gone, and pays for the party's part in it.
  for (const siege of w.sieges.filter((x) => x.town === f.town)) settle(w, data, siege);
  if (reclaim(w, data, f.town)) retaken(w, data, f.town);
}
