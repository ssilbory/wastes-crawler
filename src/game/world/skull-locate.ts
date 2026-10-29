// Query the Skull's locating questions (vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0
// Necromancer Spells.md; Sam's call, docs/rules-adaptation.md, Necromancer spells outside fights):
// below ground the dead can say where the level's boss waits, where its vault lies, or where its
// caches of loot still lie, one of the three a casting. Each answer is a sentence giving the way
// from the party in squares, and the squares named are marked on the automap until the hoard there
// is taken or its boss falls.
import { cellKey, type Cell } from '../../rules/grid.ts';
import type { Special } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { levelOf } from '../dungeon/levels.ts';
import { orderEnded } from './orders.ts';
import type { World } from './types.ts';

/** The questions that locate something on the level; a casting may ask only one of them. */
export const LOCATE = ['boss', 'vault', 'hoard'] as const;
export type LocateQuestion = (typeof LOCATE)[number];

export const isLocate = (q: string): q is LocateQuestion =>
  (LOCATE as readonly string[]).includes(q);

type Cache = Extract<Special, { kind: 'cache' }>;

const lootOf = (c: Cache) => c.loot.reduce((sum, d) => sum + d.count * d.sides, 0);

/**
 * The level's boss: the guards of the hoard with words of its own, else of a vault, else of the
 * richest guarded cache (docs/rules-adaptation.md, Boss each level).
 */
export function bossCache(caches: readonly Cache[]): Cache | undefined {
  const rank = (c: Cache) => (c.text ? 2 : 0) + (c.vault ? 1 : 0);
  return caches
    .filter((c) => c.guards)
    .reduce<Cache | undefined>(
      (best, c) =>
        !best || rank(c) > rank(best) || (rank(c) === rank(best) && lootOf(c) > lootOf(best))
          ? c
          : best,
      undefined,
    );
}

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** The way from one cell to another in squares, north up: "4 squares north and 2 east". */
export function wayTo(from: Cell, to: Cell): string {
  const [dx, dy] = [to.x - from.x, to.y - from.y];
  const legs = (
    [
      [dy, 'north', 'south'],
      [dx, 'west', 'east'],
    ] as const
  )
    .filter(([n]) => n !== 0)
    .map(([n, back, ahead]) => ({ n: Math.abs(n), dir: n < 0 ? back : ahead }));
  const [a, b] = legs;
  if (!a) return 'right here';
  return `${plural(a.n, 'square')} ${a.dir}${b ? ` and ${b.n} ${b.dir}` : ''}`;
}

type Underground = NonNullable<World['dungeon']>;

const cachesOf = (data: GameData, s: Underground) =>
  levelOf(data, s.dungeon, s.level).level.specials.filter((x): x is Cache => x.kind === 'cache');

const keyOf = (s: Underground, c: Cache) => `${s.dungeon}/${s.level}/${cellKey(c.at)}`;

/** Whether a boss still stands over its hoard: not taken, not beaten, its order not ended. */
const standing = (w: World, s: Underground, boss: Cache) =>
  !w.caches.includes(keyOf(s, boss)) &&
  !w.beaten.includes(keyOf(s, boss)) &&
  !(boss.order && orderEnded(w, boss.order));

/** A square's mark gives way only to a weightier one: a boss over a vault over a hoard. */
const WEIGHT: Record<LocateQuestion, number> = { hoard: 0, vault: 1, boss: 2 };

/** The marks still worth drawing on this level's automap: hoards untaken, each boss's or its hoard's. */
export function locatedMarks(
  w: World,
  data: GameData,
): { key: string; x: number; y: number; what: LocateQuestion }[] {
  const s = w.dungeon;
  if (!s) return [];
  const marks = s.located[s.level] ?? {};
  return cachesOf(data, s).flatMap((c) => {
    const what = marks[cellKey(c.at)];
    if (!what || w.caches.includes(keyOf(s, c))) return [];
    // A boss beaten leaves its hoard behind.
    const now = what === 'boss' && !standing(w, s, c) ? 'hoard' : what;
    return [{ key: cellKey(c.at), x: c.at.x, y: c.at.y, what: now }];
  });
}

/** Answers one locating question, marking the squares it names on the automap. */
export function locate(w: World, data: GameData, q: LocateQuestion): string {
  const s = w.dungeon as Underground;
  const caches = cachesOf(data, s);
  const left = caches.filter((c) => !w.caches.includes(keyOf(s, c)));
  const mark = (cells: Cache[]) => {
    const marks = (s.located[s.level] ??= {});
    for (const c of cells) {
      const was = marks[cellKey(c.at)];
      if (!was || WEIGHT[q] > WEIGHT[was]) marks[cellKey(c.at)] = q;
    }
  };
  const nearest = (cells: Cache[]) =>
    cells.reduce((a, b) =>
      Math.abs(b.at.x - s.at.x) + Math.abs(b.at.y - s.at.y) <
      Math.abs(a.at.x - s.at.x) + Math.abs(a.at.y - s.at.y)
        ? b
        : a,
    );
  if (q === 'boss') {
    const boss = bossCache(caches);
    if (!boss) return 'The dead know of no boss on this level.';
    if (!standing(w, s, boss)) return "The dead say this level's boss has already fallen.";
    mark([boss]);
    return `The dead say this level's boss waits ${wayTo(s.at, boss.at)}.`;
  }
  if (q === 'vault') {
    const vaults = left.filter((c) => c.vault);
    if (vaults.length === 0) return 'The dead know of no vault left on this level.';
    mark(vaults);
    return `The dead say the vault lies ${wayTo(s.at, nearest(vaults).at)}.`;
  }
  if (left.length === 0) return 'The dead know of no hoard left on this level.';
  mark(left);
  const way = wayTo(s.at, nearest(left).at);
  return left.length === 1
    ? `The dead say a hoard lies ${way}.`
    : `The dead tell of ${plural(left.length, 'hoard')} on this level, the nearest ${way}.`;
}
