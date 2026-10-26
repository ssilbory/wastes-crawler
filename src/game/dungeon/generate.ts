// Procedural ruins (docs/decisions/0004-procedural-levels.md; docs/rules-adaptation.md, Ruins in
// Phase 12e). A ruin's levels come from its own seed, drawn from the world's RNG, so the same seed
// always gives the same dungeon. Delves go down level by level and towers climb floor by floor:
// mazes with a few loops and rooms, stairs to the farthest cell, traps that grow denser level by
// level, small loot caches, one or two caches held by a band of the vault's guards, and a guarded
// vault at the far end. Cities are in city.ts.
import type { Dungeon, DungeonLevel, Facing, Ruin, RuinTrap } from '../../data/schemas/index.ts';
import { createRng, type Rng } from '../../rules/rng.ts';
import { generateCity } from './city.ts';
import {
  cacheAt,
  cellKey,
  cellOf,
  decorate,
  distances,
  emptyLevel,
  guardedCaches,
  maze,
  openFacing,
  render,
  takeCell,
  trapAt,
  vaultAt,
  type Cell,
} from './maze.ts';

interface Built {
  level: DungeonLevel;
  /** Where the party arrives, and the stairs onward. */
  arrive: Cell;
  facing: Facing;
  onward: Cell;
}

/** Delves go down: arrive on stairs up, go on by stairs down. Towers climb: arrive on stairs down
 * (the ground floor's way out is the door, stairs up to the surface), go on by stairs up. */
function buildLevel(rng: Rng, ruin: Ruin, traps: readonly RuinTrap[], index: number): Built {
  const tower = ruin.kind === 'tower';
  const w = rng.int(ruin.size.min, ruin.size.max);
  const h = rng.int(ruin.size.min, ruin.size.max);
  const edges = maze(rng, w, h);
  decorate(rng, edges, w, h);
  const arrive = { x: rng.int(0, w - 1), y: rng.int(0, h - 1) };
  const dist = distances(edges, w, h, arrive);
  const far = [...dist].reduce((a, b) => (b[1] > a[1] ? b : a))[0];
  const onward = cellOf(far);
  const last = index === ruin.depth - 1;
  const glyphs = new Map([[cellKey(arrive), tower && index > 0 ? '>' : '<']]);
  if (!last) glyphs.set(far, tower ? '<' : '>');
  // Traps and caches go on cells away from the stairs and the vault.
  const free = [...dist.keys()].filter((k) => k !== cellKey(arrive) && k !== far);
  const set = Array.from({ length: index + 2 }, () =>
    trapAt(rng, traps, takeCell(rng, free), index),
  );
  for (const t of set) glyphs.set(cellKey(t.at), 'T');
  const specials = Array.from({ length: rng.int(1, 2) }, () => cacheAt(ruin, takeCell(rng, free)));
  specials.push(...guardedCaches(rng, ruin, free));
  if (last) specials.push(vaultAt(ruin, onward));
  const word = tower ? 'floor' : 'level';
  const level = emptyLevel(
    ruin,
    `${ruin.id}-${index + 1}`,
    `${ruin.name}, ${word} ${index + 1}`,
    render(edges, w, h, glyphs),
    arrive,
  );
  return {
    level: { ...level, traps: set, specials },
    arrive,
    facing: openFacing(edges, arrive, w, h),
    onward,
  };
}

/** A generator's levels and the facing on arriving from the surface. */
export interface Generated {
  levels: DungeonLevel[];
  facing: Facing;
}

/** A delve or a tower: a chain of levels, each linked to the next by its far stairs. */
function generateStack(rng: Rng, ruin: Ruin, traps: readonly RuinTrap[]): Generated {
  const built = Array.from({ length: ruin.depth }, (_, i) => buildLevel(rng, ruin, traps, i));
  built.forEach((b, i) => {
    const prev = built[i - 1];
    const next = built[i + 1];
    // Going back lands on the previous level's stairs onward.
    b.level.links.push({
      at: b.arrive,
      to: prev ? { level: prev.level.id, at: prev.onward, facing: 'n' } : { surface: true },
    });
    if (next)
      b.level.links.push({
        at: b.onward,
        to: { level: next.level.id, at: next.arrive, facing: next.facing },
      });
  });
  return { levels: built.map((b) => b.level), facing: (built[0] as Built).facing };
}

/** The dungeon id a ruin has under a seed. */
export const ruinDungeonId = (ruin: Ruin, seed: number) => `${ruin.id}-v${seed}`;

/**
 * A ruin's dungeon under a seed, its traps drawn from `traps`: the same seed always gives the same
 * dungeon.
 */
export function generateRuin(ruin: Ruin, seed: number, traps: readonly RuinTrap[]): Dungeon {
  const rng = createRng(`${ruin.id}:${seed}`);
  const { levels, facing } =
    ruin.kind === 'city' ? generateCity(rng, ruin, traps) : generateStack(rng, ruin, traps);
  const first = levels[0] as DungeonLevel;
  const exit = first.links.find((l) => 'surface' in l.to) as DungeonLevel['links'][number];
  return {
    id: ruinDungeonId(ruin, seed),
    name: ruin.name,
    region: ruin.region,
    entrance: { col: ruin.col, row: ruin.row },
    entry: { level: first.id, at: exit.at, facing },
    levels,
  };
}

/** Generated dungeons by ruin and seed, so a level's parsed map is reused across steps. */
const generated = new WeakMap<Ruin, Map<number, Dungeon>>();

/** The generated dungeon for a ruin dungeon id ("<ruin>-v<seed>"), if the id is one. */
export function ruinDungeon(
  ruins: readonly Ruin[],
  traps: readonly RuinTrap[],
  id: string,
): Dungeon | undefined {
  const m = /^(.+)-v(\d+)$/.exec(id);
  const ruin = m && ruins.find((r) => r.id === m[1]);
  if (!m || !ruin) return undefined;
  const seed = Number(m[2]);
  const bySeed = generated.get(ruin) ?? new Map<number, Dungeon>();
  generated.set(ruin, bySeed);
  const d = bySeed.get(seed) ?? generateRuin(ruin, seed, traps);
  bySeed.set(seed, d);
  return d;
}
