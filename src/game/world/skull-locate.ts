// Query the Skull's locating questions (vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0
// Necromancer Spells.md; Sam's call, docs/rules-adaptation.md, Necromancer spells outside fights):
// below ground the dead can say where the level's boss waits, where its vault lies, or where its
// caches of loot still lie, one of the three a casting. Each answer is a sentence giving the way
// from the party in squares, and the squares named are marked on the automap.
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

/** Answers one locating question, marking the squares it names on the automap. */
export function locate(w: World, data: GameData, q: LocateQuestion): string {
  const s = w.dungeon as NonNullable<World['dungeon']>;
  const place = `${s.dungeon}/${s.level}`;
  const caches = levelOf(data, s.dungeon, s.level).level.specials.filter(
    (x): x is Cache => x.kind === 'cache',
  );
  const key = (c: Cache) => `${place}/${cellKey(c.at)}`;
  const left = caches.filter((c) => !w.caches.includes(key(c)));
  const mark = (cells: Cache[]) => {
    s.seen[s.level] = [
      ...new Set([...(s.seen[s.level] ?? []), ...cells.map((c) => cellKey(c.at))]),
    ];
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
    const standing =
      !w.caches.includes(key(boss)) &&
      !w.beaten.includes(key(boss)) &&
      !(boss.order && orderEnded(w, boss.order));
    if (!standing) return "The dead say this level's boss has already fallen.";
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
