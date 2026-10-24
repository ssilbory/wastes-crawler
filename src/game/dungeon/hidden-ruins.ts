// Small ruins found by exploring (docs/rules-adaptation.md, Explore; Sam's calls). Each is a
// one- or two-level delve built from its region and hex alone, so its id says everything needed to
// rebuild it: its wanderers and vault guards come from the hex's own encounter table, the guards an
// entry at the most its dice allow. Where they lie is the world's business (world/hidden-sites.ts).
import type { EncounterTable, Ruin } from '../../data/schemas/index.ts';
import { hexKey, type Hex } from '../../rules/hex.ts';
import { createRng, type Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { regionMap } from '../world/region.ts';

const ID = /^hidden-(.+)-(\d+)-(\d+)$/;

export const hiddenRuinId = (region: string, h: Hex) => `hidden-${region}-${h.col}-${h.row}`;

/** A hex's own stream, the same in every world: what its lair or ruin holds. */
export const hexRng = (region: string, h: Hex): Rng => createRng(`hidden:${region}:${hexKey(h)}`);

/**
 * A hostile entry of the table, picked by the hex, at the most its dice allow, as enemy rows; null
 * if the table has none (or no such table).
 */
export function strongestBand(data: GameData, tableId: string, rng: Rng): string[][] | null {
  const table = data.content.encounterTables.find((t) => t.id === tableId) as
    EncounterTable | undefined;
  const hostile = (table?.entries ?? []).filter(
    (e) => e.nature === 'hostile' && !e.order && !e.captive && !e.minClock && e.groups.length > 0,
  );
  if (hostile.length === 0) return null;
  const entry = hostile[rng.int(0, hostile.length - 1)] as (typeof hostile)[number];
  const rows: string[][] = [[], [], []];
  for (const g of entry.groups) {
    const most =
      typeof g.count === 'number' ? g.count : g.count.count * g.count.sides + g.count.modifier;
    const row = rows[g.row] as string[];
    for (let i = 0; i < most && row.length < 8; i++) row.push(g.monster);
  }
  return rows.filter((r) => r.length > 0);
}

const built = new WeakMap<GameData['content'], Map<string, Ruin | null>>();

/** The small ruin at a hex, built the same way every time; null where it could have no guards. */
export function hiddenRuin(data: GameData, region: string, h: Hex): Ruin | null {
  const id = hiddenRuinId(region, h);
  const cache = built.get(data.content) ?? new Map<string, Ruin | null>();
  built.set(data.content, cache);
  if (cache.has(id)) return cache.get(id) as Ruin | null;
  const rules = data.content.hiddenSites.ruin;
  const rng = hexRng(region, h);
  const table = regionMap(data, region).tableAt(h);
  const guards = strongestBand(data, table, rng);
  const ruin: Ruin | null = guards && {
    id,
    name: rules.names[rng.int(0, rules.names.length - 1)] as string,
    kind: 'delve',
    region,
    col: h.col,
    row: h.row,
    // Shown nowhere for a found ruin; the vault matches the land, not a party level.
    level: 1,
    depth: rng.int(rules.depth.min, rules.depth.max),
    size: { ...rules.size },
    wander: { every: rules.wanderEvery, table },
    cache: rules.cache,
    vault: { guards, loot: rules.vault },
  };
  cache.set(id, ruin);
  return ruin;
}

/** The hidden ruin a ruin id names, if it is one. */
export function hiddenRuinById(data: GameData, id: string): Ruin | null {
  const m = ID.exec(id);
  if (!m || !data.content.regions.some((r) => r.id === m[1])) return null;
  return hiddenRuin(data, m[1] as string, { col: Number(m[2]), row: Number(m[3]) });
}

/** The ruin, shipped or hidden, whose generated dungeon this is ("<ruin id>-v<seed>"). */
export function ruinOfDungeon(data: GameData, dungeonId: string): Ruin | undefined {
  const shipped = data.content.ruins.find((r) => dungeonId.startsWith(`${r.id}-v`));
  if (shipped) return shipped;
  const m = /^(.+)-v\d+$/.exec(dungeonId);
  return (m && hiddenRuinById(data, m[1] as string)) || undefined;
}
