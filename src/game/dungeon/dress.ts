// Locked doors and random chests in a ruin's levels (docs/rules-adaptation.md, Locks and chests;
// Sam's calls): one door in four is locked, and each level holds one or two random chests on free
// floor, each a third loot, a third heavily trapped and empty, and a third animated, a chest golem or
// an undead thing. They come from an RNG of their own, after the layout, so a ruin's layout under a seed
// is the same as before they were added.
import type { ChestRules, DungeonLevel, Ruin } from '../../data/schemas/index.ts';
import { parseLevelMap, type LevelMap } from '../../data/dungeon-map.ts';
import { FACINGS } from '../../rules/grid.ts';
import { createRng, type Rng } from '../../rules/rng.ts';

const FLOOR = new Set([' ', '.']);
const key = (c: { x: number; y: number }) => `${c.x},${c.y}`;

/** The level's map with some of its doors locked. */
function lockDoors(rng: Rng, rows: readonly string[], lockedIn: number): string[] {
  return rows.map((row, y) =>
    [...row]
      .map((ch, x) => {
        // Doors sit on edges: between cells, never on a cell or a corner.
        const edge = (x + y) % 2 === 1;
        return edge && ch === 'd' && rng.int(1, lockedIn) === 1 ? 'l' : ch;
      })
      .join(''),
  );
}

/**
 * Plain floor cells the party can reach, with nothing on them: no stairs, trap, special, captive,
 * or post. A cell walled on every side is solid rock.
 */
function freeCells(level: DungeonLevel): { x: number; y: number }[] {
  const map = (parseLevelMap(level.map) as { ok: true; map: LevelMap }).map;
  const open = (c: { x: number; y: number }) => FACINGS.some((f) => map.edge(c, f) !== 'wall');
  const taken = new Set([
    ...level.links.map((l) => key(l.at)),
    ...level.traps.map((t) => key(t.at)),
    ...level.specials.map((s) => key(s.at)),
    ...level.captives.map((c) => key(c.at)),
    ...level.garrisons.map((g) => key(g.at)),
    ...level.safe.map(key),
  ]);
  const out: { x: number; y: number }[] = [];
  level.map.forEach((row, r) => {
    if (r % 2 === 0) return;
    for (let col = 1; col < row.length; col += 2) {
      const c = { x: (col - 1) / 2, y: (r - 1) / 2 };
      if (FLOOR.has(row[col] as string) && !taken.has(key(c)) && open(c)) out.push(c);
    }
  });
  return out;
}

function randomChests(rng: Rng, ruin: Ruin, level: DungeonLevel, rules: ChestRules) {
  const free = freeCells(level);
  const count = Math.min(free.length, rng.int(rules.random.min, rules.random.max));
  return Array.from({ length: count }, (): DungeonLevel['specials'][number] => {
    const at = free.splice(rng.int(0, free.length - 1), 1)[0] as { x: number; y: number };
    const roll = rng.int(1, 3);
    if (roll === 1) return { kind: 'chest', at, contents: 'loot', loot: ruin.cache };
    if (roll === 2) return { kind: 'chest', at, contents: 'trapped' };
    return { kind: 'chest', at, contents: rng.int(1, 2) === 1 ? 'golem' : 'undead' };
  });
}

/** A ruin's levels with their locked doors and random chests, the same for the same seed. */
export function dressRuin(
  ruin: Ruin,
  seed: number,
  levels: DungeonLevel[],
  rules: ChestRules,
): DungeonLevel[] {
  const rng = createRng(`${ruin.id}:${seed}:locks`);
  return levels.map((level) => {
    const locked = { ...level, map: lockDoors(rng, level.map, rules.doors.lockedIn) };
    return { ...locked, specials: [...locked.specials, ...randomChests(rng, ruin, locked, rules)] };
  });
}
