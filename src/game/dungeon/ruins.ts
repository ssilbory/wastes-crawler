// Ruins (docs/rules-adaptation.md, Ruins in Phase 12e; Sam's calls). A ruin's layout seed is drawn
// from the world's RNG the first time the party goes down, and the generated dungeon must pass the
// same level validation as hand-made ones (ADR 0004) or the next seed is tried. Loot caches are
// taken once; a vault's guards must be beaten first. Thirty days after its vault is emptied, the
// ruin shifts: the next visit draws a new seed.
import { dungeonReferenceErrors } from '../../data/dungeon-check.ts';
import type { Dungeon, Ruin, Special } from '../../data/schemas/index.ts';
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from '../world/bus.ts';
import { meetGroup } from '../world/encounters.ts';
import { note } from '../world/members.ts';
import { accrueShares } from '../world/npcs.ts';
import { addLoot } from '../world/shop.ts';
import { pickUp } from '../world/party-load.ts';
import type { World } from '../world/types.ts';
import { dungeonHere, levelOf } from './explore.ts';
import { generateRuin, ruinDungeonId } from './generate.ts';

const MAX_SEED = 2 ** 31 - 1;

/** The ruin whose hex the party stands on, if any. */
export const ruinHere = (w: World, data: GameData): Ruin | undefined =>
  data.content.ruins.find((r) => r.region === w.region && hexKey(r) === hexKey(w.position));

/** The way down at the party's hex, hand-made or ruin, by name, with a ruin's party level. */
export function wayDownHere(
  w: World,
  data: GameData,
): { name: string; level: number | null } | undefined {
  const d = dungeonHere(w, data);
  if (d) return { name: d.name, level: null };
  const r = ruinHere(w, data);
  return r && { name: r.name, level: r.level };
}

/**
 * Every way down in the party's region, hand-made and ruins, for the map; `heard` marks those a
 * tavern rumor has told of, by id.
 */
export const entrancesIn = (data: GameData, region: string, rumors: readonly string[] = []) => [
  ...data.content.dungeons
    .filter((d) => d.region === region)
    .map((d) => ({ ...d.entrance, name: d.name, heard: rumors.includes(d.id) })),
  ...data.content.ruins
    .filter((r) => r.region === region)
    .map((r) => ({ col: r.col, row: r.row, name: r.name, heard: rumors.includes(r.id) })),
];

/** The ruin's dungeon for this visit, drawing a seed on the first visit or once it has shifted. */
export function openRuin(w: World, data: GameData, ruin: Ruin): Dungeon {
  const rec = w.ruins[ruin.id];
  const month = data.content.overlandRules.daysPerMonth;
  if (rec && (rec.emptied === null || w.day - rec.emptied < month))
    return generateRuin(ruin, rec.seed);
  if (rec) note(w, `${ruin.name} has shifted: old passages are choked, and new ones open.`);
  let seed = w.rng.int(1, MAX_SEED);
  let d = generateRuin(ruin, seed);
  // ADR 0004: only a layout that passes the level validation is entered.
  while (dungeonReferenceErrors({ ...data.content, dungeons: [d] }).length > 0) {
    seed = (seed % MAX_SEED) + 1;
    d = generateRuin(ruin, seed);
  }
  w.ruins[ruin.id] = { seed, emptied: null };
  return d;
}

type Cache = Extract<Special, { kind: 'cache' }>;

/** The cache on the party's cell, if one is there and not yet taken, and its key. */
function cacheHere(w: World, data: GameData): { key: string; cache: Cache } | null {
  const s = w.dungeon;
  if (!s) return null;
  const key = `${s.dungeon}/${s.level}/${s.at.x},${s.at.y}`;
  const cache = levelOf(data, s.dungeon, s.level).level.specials.find(
    (x): x is Cache => x.kind === 'cache' && x.at.x === s.at.x && x.at.y === s.at.y,
  );
  return cache && !w.caches.includes(key) ? { key, cache } : null;
}

/**
 * True while the party stands over a vault or a hand-placed hoard whose guards are not yet beaten:
 * a boss fight (Sam's call: a hoard's guards are its level's boss).
 */
export function atGuardedHoard(w: World, data: GameData): boolean {
  const found = cacheHere(w, data);
  return !!found?.cache.guards && !w.beaten.includes(found.key);
}

function take(w: World, data: GameData, key: string, cache: Cache): void {
  w.caches.push(key);
  const dice = cache.loot.map((d) => `${d.count}d${d.sides}`).join(' + ');
  note(w, `${cache.vault ? 'The vault holds' : 'A cache holds'} ${dice} of loot.`);
  const kept = pickUp(w, data, () => {
    addLoot(w, cache.loot);
    if (!cache.component) return;
    w.components[cache.component] = (w.components[cache.component] ?? 0) + 1;
    const c = data.content.components.find((x) => x.id === cache.component);
    note(w, `The party takes ${c?.name ?? cache.component}.`);
  });
  accrueShares(w, data, kept);
  if (!cache.vault) return;
  // Vaults are only generated, so the party is in a ruin it has opened.
  const ruin = data.content.ruins.find((r) => {
    const rec = w.ruins[r.id];
    return rec !== undefined && key.startsWith(`${ruinDungeonId(r, rec.seed)}/`);
  }) as Ruin;
  (w.ruins[ruin.id] as { emptied: number | null }).emptied = w.day;
  note(w, `${ruin.name} is emptied. Ruins like this shift within a month.`);
}

/** The ruins' bus listener: caches are taken on stepping onto them, a vault once its guards fall. */
export function ruinsListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind !== 'cell-entered' && e.kind !== 'fight-won') return;
  const found = cacheHere(w, data);
  if (!found || w.encounter) return;
  const { key, cache } = found;
  if (cache.guards && !w.beaten.includes(key)) {
    if (e.kind === 'fight-won') return;
    const s = w.dungeon as NonNullable<World['dungeon']>;
    const where = `${levelOf(data, s.dungeon, s.level).level.name} ${s.at.x},${s.at.y}`;
    const g = meetGroup(
      w,
      data,
      cache.guards,
      'hostile',
      null,
      null,
      cache.text ?? (cache.vault ? 'Guards stand over a vault.' : 'Guards stand over a hoard.'),
      where,
    );
    g.garrison = key;
    return;
  }
  take(w, data, key, cache);
}
