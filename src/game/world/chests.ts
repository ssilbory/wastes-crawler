// Locked, trapped vaults and boss chests (docs/rules-adaptation.md, Locks and chests; Sam's calls).
// A boss fight's drop goes into a chest where it was won, and a ruin's vault is locked the same
// way. Each has a lock and a trap of one difficulty, 7 + level / 2 at most 12, the level being the
// ruin's or the quest's, else the boss's hit dice. The party's best Wis/Notice looks for the trap
// once; a spotted trap can be disarmed with Dex/Sneak. The lock is picked with Dex/Sneak, at -2
// without Criminal Tools, or forced with Str/Exert, at +1 with a crowbar; forcing springs a trap
// still set, and a pick that misses by 2 or more does too. Each try takes a turn below ground.
// Sneak picks locks and defeats traps (vendor/wwn-srd/1.0 Character Creation/1.2.0 Skills.md);
// a lock or trap takes a turn (vendor/wwn-srd/2.0 The Rules of the Game/2.13.0 Dungeon
// Exploration.md); gear moves a check within -2 to +2 (2.3.0 Skill Checks.md, 2.3.1).
import type { ChestState } from '../../data/schemas/index.ts';
import { attemptDisarm, attemptLock, lockDifficulty, type LockMethod } from '../../rules/locks.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { ruinOfDungeon } from '../dungeon/hidden-ruins.ts';
import { blind, carried } from '../dungeon/light.ts';
import { passTurn } from '../dungeon/time.ts';
import { trapHarm } from '../dungeon/traps.ts';
import { emit } from './bus.ts';
import { alive, bestAt, memberCheck, note } from './members.ts';
import { placeKey } from './necromancy.ts';
import type { TownResult } from './services.ts';
import { spoils } from './winnings.ts';
import type { Member, World } from './types.ts';

const OK: TownResult = { ok: true };
const no = (reason: string): TownResult => ({ ok: false, reason });
const able = (w: World) => alive(w).filter((m) => !m.reviving && m.character.hp.current > 0);

/** The unopened vault or chest where the party stands, if any. */
export const chestHere = (w: World): ChestState | undefined =>
  w.chests.find((c) => c.at === placeKey(w));

/** What a chest is called in the log. */
export const chestName = (c: ChestState) => (c.vault ? 'vault' : 'chest');

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

/** The party's best Wis/Notice looks the chest over for its trap, once, if it can see. */
function look(w: World, data: GameData, c: ChestState): void {
  if (c.looked || blind(w, data)) return;
  c.looked = true;
  const eyes = bestAt(data, able(w), 'notice', ['wis']);
  if (!eyes || !memberCheck(w, data, eyes, 'notice', ['wis'], c.difficulty).success) return;
  c.trapState = 'noticed';
  note(w, `${eyes.character.name} spots a ${c.trap.name} on the ${chestName(c)}.`);
}

/** The chest here, or a new one with a lock and a trap drawn for its level. */
function chestFor(w: World, data: GameData, level: number, vault: boolean): ChestState {
  const here = chestHere(w);
  if (here) {
    if (vault && !here.vault) note(w, 'The vault is locked.');
    here.vault ||= vault;
    return here;
  }
  const rules = data.content.chests;
  const traps = rules.traps;
  const c: ChestState = {
    at: placeKey(w),
    vault,
    difficulty: lockDifficulty(rules.difficulty, level),
    trap: traps[w.rng.int(0, traps.length - 1)] as ChestState['trap'],
    trapState: 'hidden',
    looked: false,
    spoils: null,
    cache: null,
  };
  w.chests.push(c);
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

/** A loot cache locked where it lies: a vault, or a hoard whose guards fell. */
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

/** Why the party can't work on a chest here now, or null if it can. */
function blocked(w: World, data: GameData): string | null {
  if (w.encounter) return 'Settle the encounter first.';
  if (!chestHere(w)) return 'There is nothing locked here.';
  if (blind(w, data)) return 'It is too dark to work.';
  if (able(w).length === 0) return 'No one is fit to work.';
  return null;
}

/** A try at the chest takes a turn below ground. */
const spend = (w: World, data: GameData) => {
  if (w.dungeon) passTurn(w, data);
};

function spring(w: World, data: GameData, c: ChestState): void {
  c.trapState = 'sprung';
  note(w, `The ${c.trap.name} springs!`);
  trapHarm(w, data, c.trap);
}

/** The bonus the party's gear gives a way of opening the lock. */
export function gearBonus(w: World, data: GameData, method: LockMethod | 'disarm'): number {
  const { tools, crowbar } = data.content.chests;
  if (method === 'force') return carried(w, crowbar.item) > 0 ? crowbar.bonus : 0;
  return carried(w, tools.item) > 0 ? 0 : tools.without;
}

const SKILL = {
  pick: { skill: 'sneak', attrs: ['dex' as const] },
  disarm: { skill: 'sneak', attrs: ['dex' as const] },
  force: { skill: 'exert', attrs: ['str' as const] },
};

/** The member best at a way of working the chest. */
export function handFor(
  w: World,
  data: GameData,
  method: LockMethod | 'disarm',
): Member | undefined {
  const { skill, attrs } = SKILL[method];
  return bestAt(data, able(w), skill, attrs);
}

function check(w: World, data: GameData, method: LockMethod | 'disarm', c: ChestState) {
  const { skill, attrs } = SKILL[method];
  const hand = handFor(w, data, method) as Member;
  const r = memberCheck(w, data, hand, skill, attrs, c.difficulty, 0, gearBonus(w, data, method));
  return { hand, success: r.success, missedBy: Math.max(0, c.difficulty - r.score) };
}

/** A turn spent on the spotted trap: the best Dex/Sneak tries to make it safe. */
export function disarmChest(w: World, data: GameData): TownResult {
  const why = blocked(w, data);
  if (why) return no(why);
  const c = chestHere(w) as ChestState;
  look(w, data, c);
  if (c.trapState !== 'noticed') return no('No trap has been found on it.');
  const { hand, success, missedBy } = check(w, data, 'disarm', c);
  const result = attemptDisarm(success, missedBy);
  if (result === 'disarmed') {
    c.trapState = 'disarmed';
    note(w, `${hand.character.name} disarms the ${c.trap.name}.`);
  } else if (result === 'sprung') {
    note(w, `${hand.character.name} fumbles the ${c.trap.name}.`);
    spring(w, data, c);
  } else note(w, `${hand.character.name} can't work out the ${c.trap.name}.`);
  spend(w, data);
  return OK;
}

/** A turn spent picking or forcing the lock; a success opens it and pays out what it holds. */
export function openChest(w: World, data: GameData, method: LockMethod): TownResult {
  const why = blocked(w, data);
  if (why) return no(why);
  const c = chestHere(w) as ChestState;
  look(w, data, c);
  const { hand, success, missedBy } = check(w, data, method, c);
  const armed = c.trapState === 'hidden' || c.trapState === 'noticed';
  const { opens, springs } = attemptLock({ method, success, missedBy, armed });
  const name = chestName(c);
  if (method === 'force')
    note(w, `${hand.character.name} ${opens ? 'forces' : "can't force"} the ${name} open.`);
  else note(w, `${hand.character.name} ${opens ? 'picks' : "can't pick"} the ${name}'s lock.`);
  if (springs) spring(w, data, c);
  spend(w, data);
  if (opens) payOut(w, data, c);
  return OK;
}

/** The chest is opened: the boss's drop is rolled, and the cache it holds is taken. */
function payOut(w: World, data: GameData, c: ChestState): void {
  w.chests = w.chests.filter((x) => x !== c);
  if (c.spoils) spoils(w, data, c.spoils.enemies, { xp: c.spoils.xp, boss: true });
  if (c.cache) emit(w, data, { kind: 'chest-opened', cache: c.cache });
}
