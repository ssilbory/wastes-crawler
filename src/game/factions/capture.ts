// Captured settlements (Phase 23b; docs/rules-adaptation.md, Sieges: Capture, A held settlement;
// Sam's calls). When a siege razes the ally's base in one of its settlements, the attacker holds
// it: it gains a Base of Influence there at 1 hit point, bought up a Treasure a hit point each turn
// to the size of the one razed (vendor/wwn-srd/6.0 Factions/Faction Turn Actions.md, Expand
// Influence). Whatever the party built there is lost. A rival's siege that razes the holder's base
// takes it in turn; the ally's own siege, or the party storming it, takes it back the same way.
// A settlement left with no one's base, its holder collapsed, goes back to the ally.
import type { FactionState } from '../../data/schemas/index.ts';
import { factionMaxHp } from '../../rules/factions.ts';
import type { GameData } from '../character/context.ts';
import { allProjects, projectOf } from '../world/major-projects.ts';
import { note } from '../world/members.ts';
import { allyTowns, besieged, holderOf } from '../world/siege-state.ts';
import type { World } from '../world/types.ts';
import { destroyWorkings } from '../world/workings.ts';
import { factionOf, isActive, locationName } from './state.ts';

const ally = (data: GameData) => data.content.siegeRules.ally;

/** The size of the ally's base in one of its settlements, as content starts it. */
export function baseSize(data: GameData, town: string): number {
  const f = factionOf(data, ally(data));
  return town === f.hq ? factionMaxHp(f) : (f.bases.find((b) => b.at === town)?.hp ?? 1);
}

/** A new base of 1 hit point, to be bought up to the ally's size there. */
function plant(data: GameData, s: FactionState, town: string): void {
  const max = baseSize(data, town);
  s.bases.push({ at: town, hp: 1, max, ...(max > 1 ? { growing: true } : {}) });
}

/** What the party built in a settlement is lost with it: projects worked there, and Workings. */
export function loseBuilt(w: World, data: GameData, town: string): void {
  const built = allProjects(w, data).filter((p) => p.at === town && w.majorProjects[p.id]);
  const gone = new Set(built.map((p) => p.id));
  w.majorProjects = Object.fromEntries(
    Object.entries(w.majorProjects).filter(([id]) => !gone.has(id)),
  );
  if (built.length > 0)
    note(
      w,
      `Lost with ${locationName(data, town)}: ${built.map((p) => projectOf(data, p.id).name).join(', ')}.`,
    );
  destroyWorkings(w, data, town);
}

/**
 * One of the ally's settlements has fallen to a siege, and its attacker takes it: from the ally,
 * or from the rival that held it before. Returns whether it did.
 */
export function capture(w: World, data: GameData, attacker: string, town: string): boolean {
  const s = w.factions[attacker];
  if (!allyTowns(data).includes(town) || !isActive(s) || attacker === ally(data)) return false;
  if (s.bases.some((b) => b.at === town)) return false;
  plant(data, s, town);
  note(w, `${factionOf(data, attacker).name} now holds ${locationName(data, town)}.`);
  loseBuilt(w, data, town);
  return true;
}

/**
 * The ally takes back a settlement of its own that has neither its base nor a holder's: a new
 * base there, and its services open again. Returns whether it did.
 */
export function reclaim(w: World, data: GameData, town: string): boolean {
  const s = w.factions[ally(data)];
  if (!allyTowns(data).includes(town) || !isActive(s)) return false;
  if (s.bases.some((b) => b.at === town) || holderOf(w, data, town)) return false;
  plant(data, s, town);
  note(w, `${locationName(data, town)} is free again: ${factionOf(data, ally(data)).name} return.`);
  return true;
}

/** The party helped take a settlement back: Renown (Sieges: Rewards). */
export function retaken(w: World, data: GameData, town: string): void {
  const renown = data.content.siegeRules.renown;
  w.renown += renown;
  note(w, `${locationName(data, town)} thanks the party for its freedom: ${renown} Renown.`);
}

/** Every settlement of the ally's left with no one's base, taken back. */
export function reclaimAll(w: World, data: GameData): void {
  // A besieged settlement falls to its besieger instead (siege.ts, settle).
  for (const town of allyTowns(data)) if (!besieged(w, town)) reclaim(w, data, town);
}

/** Expand Influence on a base taken or retaken: a Treasure a hit point until it is whole. */
export function growBases(s: FactionState): void {
  for (const b of s.bases.filter((x) => x.growing)) {
    const bought = Math.min(b.max - b.hp, s.treasure);
    b.hp += bought;
    s.treasure -= bought;
    if (b.hp === b.max) delete b.growing;
  }
}

/**
 * While a settlement of its own is held, the ally's goal is to root its holder out of it (Sam's
 * call: retaking comes first).
 */
export function retakeGoal(w: World, data: GameData): void {
  const s = w.factions[ally(data)];
  if (!isActive(s)) return;
  for (const town of allyTowns(data)) {
    const holder = holderOf(w, data, town);
    if (!holder) continue;
    const t = s.goal?.target;
    if (s.goal?.kind === 'root-out' && t?.faction === holder && t.at === town) return;
    s.goal = { kind: 'root-out', target: { faction: holder, at: town }, progress: 0 };
    return;
  }
}
