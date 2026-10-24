// Hidden sites and the Explore activity (docs/rules-adaptation.md, Explore; Sam's calls, after
// SRD 2.12.1 "Exploring a Hex", vendor/wwn-srd/2.0 The Rules of the Game/2.12.0 Wilderness
// Exploration and Expeditions.md). About one wild hex in 15 holds a cache, a lair, a small ruin, or
// a shrine, placed from the world's own seed. A quarter's exploring finds a lair or a ruin; a cache
// or a shrine also needs the best explorer's Wis/Survive check. Nothing hints at a site beforehand.
import type { Region, Ruin } from '../../data/schemas/index.ts';
import { hexKey, type Hex } from '../../rules/hex.ts';
import { createRng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { hexRng, hiddenRuin, strongestBand } from '../dungeon/hidden-ruins.ts';
import type { WorldEvent } from './bus.ts';
import { meetGroup } from './encounters.ts';
import { alive, bestAt, memberCheck, note } from './members.ts';
import { accrueShares } from './npcs.ts';
import { pickUp } from './party-load.ts';
import { regionMap } from './region.ts';
import { addLoot } from './shop.ts';
import type { Member, World } from './types.ts';

export type SiteKind = 'cache' | 'lair' | 'ruin' | 'shrine';
const KINDS: readonly SiteKind[] = ['cache', 'lair', 'ruin', 'shrine'];

export interface HiddenSite {
  kind: SiteKind;
  /** "<region>:<col>,<row>", as the world records it found and done. */
  key: string;
  hex: Hex;
  /** Which of its kind's texts (or shrines) it is. */
  pick: number;
}

const siteKey = (region: string, h: Hex) => `${region}:${hexKey(h)}`;
const lairKey = (key: string) => `site:${key}`;

/** Hexes something else already holds: towns, exits, ways down, groves, posts, and story hexes. */
function claimed(data: GameData, region: string): Set<string> {
  const c = data.content;
  const keys = [
    ...c.dungeons.filter((d) => d.region === region).map((d) => d.entrance),
    ...c.ruins.filter((r) => r.region === region),
    ...c.groves.filter((g) => g.region === region),
    // The region is the map's own, so it is always there.
    ...(c.regions.find((r) => r.id === region) as Region).garrisons,
    ...c.quests.flatMap((q) =>
      q.objectives.flatMap((o) =>
        'hex' in o && 'region' in o && o.region === region ? [o.hex] : [],
      ),
    ),
    ...c.realms.flatMap((r) => (r.ending?.region === region ? [r.ending] : [])),
  ];
  return new Set(keys.map(hexKey));
}

const placed = new WeakMap<GameData['content'], Map<string, Map<string, HiddenSite>>>();

/** A region's hidden sites under a world's seed, by key; the same seed always places the same. */
export function sitesIn(data: GameData, seed: number, region: string): Map<string, HiddenSite> {
  const byRegion = placed.get(data.content) ?? new Map<string, Map<string, HiddenSite>>();
  placed.set(data.content, byRegion);
  const memo = `${seed}:${region}`;
  const known = byRegion.get(memo);
  if (known) return known;
  const rules = data.content.hiddenSites;
  const map = regionMap(data, region);
  const taken = claimed(data, region);
  const weights = KINDS.map((k) => rules.weights[k]);
  const total = weights.reduce((a, b) => a + b, 0);
  const sites = new Map<string, HiddenSite>();
  for (let row = 0; row < map.height; row++)
    for (let col = 0; col < map.width; col++) {
      const h = { col, row };
      const wild =
        map.costOf(h) !== null &&
        map.dangerAt(h) !== 'road' &&
        !map.siteAt(h) &&
        !map.exitAt(h) &&
        !taken.has(hexKey(h));
      const rng = createRng(`${seed}:${region}:${hexKey(h)}`);
      if (!wild || total === 0 || rng.int(1, rules.odds) !== 1) continue;
      let roll = rng.int(1, total);
      let kind = KINDS[weights.findIndex((x) => (roll -= x) <= 0)] as SiteKind;
      // A lair or a ruin needs monsters from the hex's table; without any it is a cache.
      const table = map.tableAt(h);
      if ((kind === 'lair' || kind === 'ruin') && !strongestBand(data, table, hexRng(region, h)))
        kind = 'cache';
      sites.set(siteKey(region, h), {
        kind,
        key: siteKey(region, h),
        hex: h,
        pick: rng.int(0, 99),
      });
    }
  byRegion.set(memo, sites);
  return sites;
}

/** The hidden site on the party's hex, found or not. */
export const siteHere = (w: World, data: GameData): HiddenSite | undefined =>
  sitesIn(data, w.sites.seed, w.region).get(siteKey(w.region, w.position));

const isFound = (w: World, s: HiddenSite) => w.sites.found.includes(s.key);
const isDone = (w: World, s: HiddenSite) => w.sites.done.includes(s.key);
const pickOf = <T>(list: readonly T[], s: HiddenSite) => list[s.pick % list.length] as T;

/** The small ruin found on the party's hex, to be entered like any ruin. */
export function foundRuinHere(w: World, data: GameData): Ruin | undefined {
  const s = siteHere(w, data);
  return (s?.kind === 'ruin' && isFound(w, s) && hiddenRuin(data, w.region, s.hex)) || undefined;
}

/** Found ruins, and lairs not yet beaten, in a region: what the map shows. */
export function foundSitesIn(
  w: World,
  data: GameData,
  region: string,
): (Hex & { name: string; kind: 'lair' | 'ruin' })[] {
  type Marker = Hex & { name: string; kind: 'lair' | 'ruin' };
  return [...sitesIn(data, w.sites.seed, region).values()].flatMap((s): Marker[] => {
    if (!isFound(w, s) || isDone(w, s)) return [];
    if (s.kind === 'ruin') {
      const ruin = hiddenRuin(data, region, s.hex) as Ruin;
      return [{ ...s.hex, name: ruin.name, kind: 'ruin' as const }];
    }
    // Caches and shrines are used up as they are found, so a found site still standing is a lair.
    return [{ ...s.hex, name: 'A lair', kind: 'lair' as const }];
  });
}

/** The lair's monsters, met with the lead text: they attack, but the party sees them first. */
function springLair(w: World, data: GameData, s: HiddenSite, lead: string): void {
  const table = regionMap(data, w.region).tableAt(s.hex);
  const guards = strongestBand(data, table, hexRng(w.region, s.hex)) as string[][];
  const e = meetGroup(w, data, guards, 'hostile', null, null, lead);
  e.garrison = lairKey(s.key);
  e.spotted = true;
}

function takeLoot(w: World, data: GameData, loot: Parameters<typeof addLoot>[1]): void {
  const dice = loot.map((d) => `${d.count}d${d.sides}`).join(' + ');
  note(w, `The party takes ${dice} of loot.`);
  accrueShares(
    w,
    data,
    pickUp(w, data, () => addLoot(w, loot)),
  );
}

function blessing(w: World, boon: 'heal' | 'strain' | 'none'): void {
  for (const m of alive(w)) {
    const c = m.character;
    if (boon === 'heal') m.character = { ...c, hp: { ...c.hp, current: c.hp.max } };
    if (boon === 'strain')
      m.character = { ...c, strain: { ...c.strain, value: Math.max(0, c.strain.value - 1) } };
  }
}

/**
 * A camp quarter's exploring: the hex's hidden site, if any, is looked for. Returns the extra
 * encounter checks owed, one whenever anyone explores outside town.
 */
export function explore(w: World, data: GameData, scouts: Member[]): number {
  const map = regionMap(data, w.region);
  const best = bestAt(data, scouts, 'survive', ['wis']);
  if (!best || map.siteAt(w.position)) return 0;
  const rules = data.content.hiddenSites;
  const s = siteHere(w, data);
  const nothing = () => note(w, `${best.character.name} scouts the hex and finds nothing new.`);
  if (!s || isFound(w, s)) {
    nothing();
    return 1;
  }
  if (s.kind === 'cache' || s.kind === 'shrine') {
    const rugged = map.terrainAt(w.position).movement === 'difficult';
    const difficulty = rules.difficulty + (rugged ? rules.difficultTerrain : 0);
    if (!memberCheck(w, data, best, 'survive', ['wis'], difficulty).success) {
      nothing();
      return 1;
    }
  }
  w.sites.found.push(s.key);
  if (s.kind === 'cache') {
    note(w, pickOf(rules.cache.texts, s));
    takeLoot(w, data, rules.cache.loot);
    w.sites.done.push(s.key);
  } else if (s.kind === 'shrine') {
    const shrine = pickOf(rules.shrines, s);
    note(w, shrine.text);
    blessing(w, shrine.boon);
    w.sites.done.push(s.key);
  } else if (s.kind === 'lair') springLair(w, data, s, pickOf(rules.lair.texts, s));
  else {
    const ruin = hiddenRuin(data, w.region, s.hex) as Ruin;
    note(w, `${pickOf(rules.ruin.texts, s)} ${best.character.name} has found ${ruin.name}.`);
  }
  return 1;
}

/** The bus listener: a found lair's monsters wait for the party's return, and give up loot when beaten. */
export function sitesListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'fight-won' && e.garrison?.startsWith('site:')) {
    const key = e.garrison.slice('site:'.length);
    if (w.sites.done.includes(key)) return;
    w.sites.done.push(key);
    note(w, 'The lair is cleared.');
    takeLoot(w, data, data.content.hiddenSites.lair.loot);
    return;
  }
  if (e.kind !== 'hex-entered' || w.encounter || w.dungeon) return;
  const s = siteHere(w, data);
  if (s?.kind === 'lair' && isFound(w, s) && !isDone(w, s))
    springLair(w, data, s, 'The lair is still here, and so are its owners.');
}
