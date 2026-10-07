// High Magic's travel spells (vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0 High Magic Spells by
// Level.md; Sam's calls, docs/rules-adaptation.md, High Magic travel spells). The Ochre Sigil of
// Juxtaposition, cast in a dungeon, sets the party on the dungeon's hex outside. Open the High
// Road carries the party to a town it has visited in its region; one casting in ten lands a few
// hexes off. Each spends one of the day's spells and takes no time.
import { distance, hexKey, type Hex } from '../../rules/hex.ts';
import type { Site } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { douse } from '../dungeon/light.ts';
import { emit } from './bus.ts';
import { cannotCast, spendCast } from './casting.ts';
import { hexesToAvoid } from './groves.ts';
import { alive, note } from './members.ts';
import { findPath, regionMap } from './region.ts';
import type { TownResult } from './services.ts';
import { enterTown } from './town.ts';
import type { Member, World } from './types.ts';

export const SIGIL = 'the-ochre-sigil-of-juxtaposition';
export const HIGH_ROAD = 'open-the-high-road';

/** How far off target a stray High Road can land, in hexes. */
const STRAY = 3;

const no = (reason: string): TownResult => ({ ok: false, reason });

/** Living members with the spell prepared. */
export const castersOf = (w: World, spell: string): Member[] =>
  alive(w).filter((m) => m.character.spells.prepared.includes(spell));

/** The caster, if they can cast the spell now; else why not. */
function caster(w: World, data: GameData, memberId: string, spell: string): Member | string {
  const m = w.members.find((x) => x.id === memberId);
  return cannotCast(data, m, spell) ?? (m as Member);
}

/** The Ochre Sigil: out of the dungeon, onto its hex. */
export function sigilEscape(w: World, data: GameData, memberId: string): TownResult {
  if (!w.dungeon) return no('The party is not in a dungeon.');
  if (w.encounter) return no('Settle the encounter first.');
  const m = caster(w, data, memberId, SIGIL);
  if (typeof m === 'string') return no(m);
  spendCast(data, m, SIGIL);
  w.dungeon = null;
  douse(w);
  note(w, `${m.character.name} speaks the sigil, and the party stands outside under the sky.`);
  return { ok: true };
}

/** Towns the High Road can reach: visited, in this region, and not where the party stands. */
export function highRoads(w: World, data: GameData): Site[] {
  return regionMap(data, w.region).sites.filter(
    (s) => w.towns[s.id] !== undefined && hexKey(s) !== hexKey(w.position),
  );
}

/**
 * Where a stray High Road sets the party down: open ground near the town, off any uncleared grove,
 * from which it can walk on to the town; null if there is none.
 */
function strayHex(w: World, data: GameData, town: Site): Hex | null {
  const map = regionMap(data, w.region);
  const avoid = hexesToAvoid(w, data, null);
  const near: Hex[] = [];
  for (let col = town.col - STRAY; col <= town.col + STRAY; col++)
    for (let row = town.row - STRAY; row <= town.row + STRAY; row++) {
      const h = { col, row };
      const d = distance(h, town);
      if (d < 1 || d > STRAY || map.costOf(h) === null) continue;
      if (map.siteAt(h) || avoid.has(hexKey(h))) continue;
      near.push(h);
    }
  const known = new Set([hexKey(town), ...near.map(hexKey)]);
  const open = near.filter((h) => findPath(map, h, town, known, avoid) !== null);
  return open.length === 0 ? null : (open[w.rng.int(0, open.length - 1)] as Hex);
}

/** Open the High Road to a visited town. */
export function openHighRoad(
  w: World,
  data: GameData,
  memberId: string,
  townId: string,
): TownResult {
  if (w.dungeon) return no('The High Road opens only under the sky.');
  if (w.encounter) return no('Settle the encounter first.');
  if (w.coach) return no('The party is on a coach.');
  const town = highRoads(w, data).find((s) => s.id === townId);
  if (!town) return no('The party knows no such town to open the road to.');
  const m = caster(w, data, memberId, HIGH_ROAD);
  if (typeof m === 'string') return no(m);
  spendCast(data, m, HIGH_ROAD);
  w.destination = null;
  // SRD 4.4.0: one casting in ten opens onto somewhere else.
  const stray = w.rng.int(1, 10) === 1 ? strayHex(w, data, town) : null;
  w.position = stray ?? { col: town.col, row: town.row };
  w.visited.add(hexKey(w.position));
  note(w, `${m.character.name} opens the High Road toward ${town.name}.`);
  if (!stray) {
    enterTown(w, data, town.id);
    return { ok: true };
  }
  note(w, `The road opens astray; ${town.name} lies a short march off.`);
  emit(w, data, { kind: 'hex-entered' });
  return { ok: true };
}
