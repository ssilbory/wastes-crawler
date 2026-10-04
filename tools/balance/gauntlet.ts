// The balance tool's gauntlets (tools/balance.ts): the starter party levelled automatically, worn down
// by the fights before each campaign fight, with no rest between.
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import type { Character, EncounterTable } from '../../src/data/schemas/index.ts';
import { autoLevel } from '../../src/game/character/auto-level.ts';
import { importCharacter } from '../../src/game/character/io.ts';
import { runBattle } from '../../src/game/combat/battle.ts';
import { carryBack, partyBattle } from '../../src/game/world/fight.ts';
import { newWorld } from '../../src/game/world/new-world.ts';
import type { Member } from '../../src/game/world/types.ts';
import { roll } from '../../src/rules/dice.ts';
import { createRng, type Rng } from '../../src/rules/rng.ts';

export const data = { srd: loadSrd(), content: loadContent() };
const arg = (name: string, fallback: string) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? (process.argv[i + 1] ?? fallback) : fallback;
};
export const RUNS = Number(arg('runs', '200'));
export const SEED = arg('seed', 'balance');
export const TARGET = 0.7;
export const MAX_LEVEL = 8;
const REAR = ['Lirael', 'Fizzwick'];

const dir = 'tools/sim/parties/starter';
const starters: Character[] = readdirSync(dir)
  .filter((f) => f.endsWith('.json'))
  .sort()
  .map((f) => {
    const r = importCharacter(readFileSync(join(dir, f), 'utf8'), data);
    if (!r.ok) throw new Error(`${f}: ${r.errors.join('; ')}`);
    return r.character;
  });
const parties = new Map<number, Character[]>();
const partyAt = (level: number) => {
  let p = parties.get(level);
  if (!p) {
    p = starters.map((c) => autoLevel(data, c, level, createRng(`${SEED}-level-${level}-${c.id}`)));
    parties.set(level, p);
  }
  return p;
};

/** A fight is a fixed group or a wandering roll from a table. */
export type Step = { enemies: string[][] } | { table: string };

function rollTable(rng: Rng, id: string): string[][] {
  const table = data.content.encounterTables.find((t) => t.id === id) as EncounterTable;
  const entries = table.entries.filter((e) => (e.minClock ?? 0) === 0);
  let pick = rng.int(
    1,
    entries.reduce((n, e) => n + e.weight, 0),
  );
  const entry = entries.find((e) => (pick -= e.weight) <= 0) as (typeof entries)[0];
  const rows: string[][] = [[], [], []];
  for (const g of entry.groups) {
    const n = typeof g.count === 'number' ? g.count : Math.max(1, roll(rng, g.count).total);
    for (let i = 0; i < n && (rows[g.row] as string[]).length < 8; i++)
      (rows[g.row] as string[]).push(g.monster);
  }
  return rows.filter((r) => r.length > 0);
}

/** One run of a gauntlet with no rest between fights; true if the party wins them all. */
function survives(level: number, steps: Step[], run: number): boolean {
  const rng = createRng(`${SEED}-${level}-${run}`);
  const recruits = partyAt(level).map((character) => ({
    character,
    row: REAR.includes(character.name) ? 1 : 0,
    column: 0,
    defaultAction: 'auto' as const,
  }));
  recruits.forEach(
    (r, i) => (r.column = recruits.slice(0, i).filter((x) => x.row === r.row).length),
  );
  const w = newWorld(data, rng, recruits);
  for (const step of steps) {
    const enemies = 'table' in step ? rollTable(rng, step.table) : step.enemies;
    if (w.members.every((m) => m.dead || m.character.hp.current <= 0)) return false;
    const fight = partyBattle(w, data, enemies, false, null);
    const result = runBattle(fight.battle);
    fight.memberIds.forEach((id, i) =>
      carryBack(
        data,
        w.members.find((m) => m.id === id) as Member,
        fight.battle.combatants[i] as never,
      ),
    );
    if (result.outcome !== 'party') return false;
  }
  return true;
}

export const winRate = (level: number, steps: Step[]) => {
  let wins = 0;
  for (let run = 0; run < RUNS; run++) if (survives(level, steps, run)) wins += 1;
  return wins / RUNS;
};

export interface Fight {
  name: string;
  minLevel: number | null;
  /** The fights before it, worn down. */
  before: Step[];
  enemies: string[][];
}

export const fights: Fight[] = [];
/** The wandering fights and posts on a dungeon's levels down to and including `level`. */
function delveBefore(dungeonId: string, level: string): Step[] {
  const d = data.content.dungeons.find((x) => x.id === dungeonId);
  if (!d) return [];
  const upTo = d.levels.slice(0, d.levels.findIndex((l) => l.id === level) + 1);
  // Posts whose order a token found in this dungeon ends are stood down, not fought.
  const tokens = d.levels.flatMap((l) =>
    l.specials.flatMap((s) => (s.kind === 'token' ? [s.authority] : [])),
  );
  const stoodDown = (order: string) =>
    data.content.authorities.some(
      (a) => tokens.includes(a.id) && (a.commands === 'all' || a.commands.includes(order)),
    );
  return upTo.flatMap((l): Step[] => [
    ...(l.wander ? [{ table: l.wander.table }] : []),
    ...l.garrisons.filter((g) => !stoodDown(g.order)).map((g) => ({ enemies: g.enemies })),
  ]);
}
const terrainTable = (region: string, col: number, row: number) => {
  const r = data.content.regions.find((x) => x.id === region);
  const glyph = r?.terrain[row]?.[col];
  const t = data.content.terrains.find((x) => x.glyph === glyph);
  return (t && r?.encounters[t.id]) ?? t?.encounters ?? 'plains';
};
for (const q of data.content.quests)
  for (const o of q.objectives) {
    if (o.kind === 'guardian') {
      const tier1 = o.reinforce !== undefined;
      fights.push({
        name: `${q.name}${tier1 ? ' (clock tier 1)' : ''}`,
        minLevel: q.prerequisites.minLevel,
        before: delveBefore(o.dungeon, o.level),
        enemies: tier1
          ? [[...(o.enemies[0] ?? []), o.reinforce as string], ...o.enemies.slice(1)]
          : o.enemies,
      });
    } else if (o.kind === 'slay')
      fights.push({
        name: q.name,
        minLevel: q.prerequisites.minLevel,
        before: [{ table: terrainTable(o.region, o.hex.col, o.hex.row) }],
        enemies: o.enemies,
      });
  }
const questLevel = (dungeon: string) => {
  const levels = data.content.quests
    .filter((q) => q.objectives.some((o) => 'dungeon' in o && o.dungeon === dungeon))
    .map((q) => q.prerequisites.minLevel);
  return levels.length > 0 ? Math.min(...levels) : null;
};
for (const d of data.content.dungeons)
  for (const l of d.levels)
    for (const g of l.garrisons)
      fights.push({
        name: `${d.name}, ${l.name} post ${g.at.x},${g.at.y}`,
        minLevel: questLevel(d.id),
        before: delveBefore(d.id, l.id).filter((s) => !('enemies' in s && s.enemies === g.enemies)),
        enemies: g.enemies,
      });
for (const r of data.content.ruins)
  fights.push({
    name: `${r.name} vault`,
    minLevel: r.level,
    before: Array.from({ length: r.kind === 'city' && r.sewer ? 2 : r.depth }, () => ({
      table: r.wander.table,
    })),
    enemies: r.vault.guards,
  });
