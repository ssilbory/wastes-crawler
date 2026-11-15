// Locked chests and vaults (docs/rules-adaptation.md, Locks and chests; Sam's calls). A boss fight's
// drop goes into a locked, trapped chest where it was won; a ruin's vault is locked and trapped the
// same way; and ruin levels hold a few random locked chests: loot, a heavily trapped empty one, or
// an animated one. The lock and trap share one difficulty, 7 + level / 2 at most 12, the level
// being the ruin's or the quest's, else the guards' highest hit dice. Working the lock and its trap
// is lockwork.ts; each try takes a turn below ground (vendor/wwn-srd/2.0 The Rules of the
// Game/2.13.0 Dungeon Exploration.md).
import type { ChestState, LockState, Special } from '../../data/schemas/index.ts';
import { lockDifficulty, type LockMethod } from '../../rules/locks.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { ruinOfDungeon } from '../dungeon/hidden-ruins.ts';
import { levelOf } from '../dungeon/levels.ts';
import { callWanderers, passTurn } from '../dungeon/time.ts';
import { emit, type WorldEvent } from './bus.ts';
import { meetGroup } from './encounters.ts';
import { cannotWork, disarmLock, lookOver, newLock, tryLock } from './lockwork.ts';
import { note } from './members.ts';
import { placeKey } from './necromancy.ts';
import { accrueShares } from './npcs.ts';
import { pickUp } from './party-load.ts';
import type { TownResult } from './services.ts';
import { addLoot } from './shop.ts';
import { spoils } from './winnings.ts';
import type { World } from './types.ts';

const OK: TownResult = { ok: true };
const no = (reason: string): TownResult => ({ ok: false, reason });

/** The unopened vault or chest where the party stands, if any. */
export const chestHere = (w: World): ChestState | undefined =>
  w.chests.find((c) => c.at === placeKey(w));

/** What a chest is called in the log. */
export const chestName = (c: Pick<ChestState, 'vault'>) => (c.vault ? 'vault' : 'chest');

/**
 * The level a chest's lock is set for: the shipped ruin's, else the quest's, else the highest hit
 * dice among those who guarded it.
 */
export function chestLevel(
  w: World,
  data: GameData,
  quest: string | null,
  guards: readonly (readonly string[])[],
): number {
  const ruin = w.dungeon && ruinOfDungeon(data, w.dungeon.dungeon);
  if (ruin && data.content.ruins.includes(ruin)) return ruin.level;
  const q = quest && data.content.quests.find((x) => x.id === quest);
  if (q) return q.prerequisites.minLevel;
  return Math.max(1, ...guards.flat().map((id) => findMonster(data, id)?.hitDice ?? 1));
}

const look = (w: World, data: GameData, c: ChestState) =>
  lookOver(w, data, c, chestName(c), c.animated !== null);

/** A new chest where the party stands, with its lock. */
function newChest(w: World, lock: LockState, vault: boolean): ChestState {
  const c: ChestState = {
    ...lock,
    at: placeKey(w),
    vault,
    spoils: null,
    cache: null,
    loot: null,
    animated: null,
  };
  w.chests.push(c);
  return c;
}

/** The chest here, or a new trapped one with a lock for its level. */
function chestFor(w: World, data: GameData, level: number, vault: boolean): ChestState {
  const here = chestHere(w);
  if (here) {
    if (vault && !here.vault) note(w, 'The vault is locked.');
    here.vault ||= vault;
    return here;
  }
  const difficulty = lockDifficulty(data.content.chests.difficulty, level);
  const c = newChest(w, newLock(w, data, difficulty, true), vault);
  note(w, vault ? 'The vault is locked.' : 'The boss leaves a locked chest.');
  return c;
}

/** A boss fight's drop, locked in a chest where it was won. */
export function lockSpoils(
  w: World,
  data: GameData,
  enemies: string[][],
  xp: number,
  quest: string | null,
): void {
  const c = chestFor(w, data, chestLevel(w, data, quest, enemies), false);
  c.spoils = { enemies, xp };
  look(w, data, c);
}

/** A vault's loot cache, locked where it lies. */
export function lockCache(
  w: World,
  data: GameData,
  key: string,
  vault: boolean,
  guards: readonly (readonly string[])[],
): void {
  const c = chestFor(w, data, chestLevel(w, data, null, guards), vault);
  c.cache = key;
  look(w, data, c);
}

type RandomChest = Extract<Special, { kind: 'chest' }>;

/**
 * The random chests' bus listener: stepping onto one for the first time finds it locked, and it
 * stays where it is until opened.
 */
export function randomChestsListener(w: World, data: GameData, e: WorldEvent): void {
  const s = w.dungeon;
  if (e.kind !== 'cell-entered' || !s) return;
  const spot = levelOf(data, s.dungeon, s.level).level.specials.find(
    (x): x is RandomChest => x.kind === 'chest' && x.at.x === s.at.x && x.at.y === s.at.y,
  );
  const key = placeKey(w);
  if (!spot || w.caches.includes(key)) return;
  w.caches.push(key);
  const difficulty = lockDifficulty(data.content.chests.difficulty, chestLevel(w, data, null, []));
  const alive = spot.contents === 'mimic' || spot.contents === 'swarm';
  const heavy = spot.contents === 'trapped';
  const c = newChest(w, newLock(w, data, difficulty, !alive, heavy), false);
  c.loot = spot.contents === 'loot' ? (spot.loot ?? null) : null;
  c.animated = alive ? (spot.contents as 'mimic' | 'swarm') : null;
  note(w, 'A locked chest stands here.');
  look(w, data, c);
}

/** A try at the chest takes a turn below ground. */
const spend = (w: World, data: GameData) => {
  if (w.dungeon) passTurn(w, data);
};

/** Why the party can't work on a chest here now, or null if it can. */
function blocked(w: World, data: GameData): string | null {
  if (!chestHere(w)) return 'There is nothing locked here.';
  return cannotWork(w, data);
}

/** A turn spent on the spotted trap: the best Dex/Sneak tries to make it safe. */
export function disarmChest(w: World, data: GameData): TownResult {
  const why = blocked(w, data);
  if (why) return no(why);
  const c = chestHere(w) as ChestState;
  look(w, data, c);
  if (!disarmLock(w, data, c)) return no('No trap has been found on it.');
  spend(w, data);
  return OK;
}

/** A turn spent picking or forcing the lock; a success opens it. */
export function openChest(w: World, data: GameData, method: LockMethod): TownResult {
  const why = blocked(w, data);
  if (why) return no(why);
  const c = chestHere(w) as ChestState;
  look(w, data, c);
  const opens = tryLock(w, data, c, chestName(c), method);
  spend(w, data);
  // A wandering group the turn brought holds the opening back: the chest is opened after.
  if (opens) payOut(w, data, c);
  return OK;
}

/** The chest is opened: whatever is inside comes out. */
function payOut(w: World, data: GameData, c: ChestState): void {
  w.chests = w.chests.filter((x) => x !== c);
  if (c.animated) {
    wake(w, data, c.animated);
    return;
  }
  if (c.spoils) spoils(w, data, c.spoils.enemies, { xp: c.spoils.xp, boss: true });
  if (c.cache) emit(w, data, { kind: 'chest-opened', cache: c.cache });
  if (c.loot) {
    note(w, `The chest holds ${c.loot.map((d) => `${d.count}d${d.sides}`).join(' + ')} of loot.`);
    const loot = c.loot;
    accrueShares(
      w,
      data,
      pickUp(w, data, () => addLoot(w, loot)),
    );
  }
  if (!c.spoils && !c.cache && !c.loot) note(w, 'The chest is empty.');
}

/** An animated chest: the chest itself lunges, or the level's wanderers burst out of it. */
function wake(w: World, data: GameData, how: 'mimic' | 'swarm'): void {
  const s = w.dungeon;
  const wanderers = s && levelOf(data, s.dungeon, s.level).level.wander;
  if (how === 'swarm' && wanderers && !w.encounter) {
    note(w, 'The lid bursts open, and things pour out!');
    callWanderers(w, data);
    if (w.encounter) return;
  }
  note(w, 'The chest lunges at the party!');
  const where = s
    ? `${levelOf(data, s.dungeon, s.level).level.name} ${s.at.x},${s.at.y}`
    : undefined;
  meetGroup(
    w,
    data,
    [[data.content.chests.random.mimic]],
    'hostile',
    null,
    null,
    'An animated chest.',
    where,
  );
}
