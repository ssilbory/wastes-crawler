// Working a lock and its trap (docs/rules-adaptation.md, Locks and chests; Sam's calls), shared by
// chests, vaults, and locked doors. The party's best Wis/Notice looks a lock over once for its trap;
// a spotted trap can be disarmed with Dex/Sneak; the lock is picked with Dex/Sneak, at -2 without
// Criminal Tools, or forced with Str/Exert, at +1 with a crowbar. Forcing springs a trap still set,
// and so does a pick or a disarm that misses by 2 or more. A heavily trapped lock's trap is harder
// to find and work, and its damage dice are multiplied. Sneak picks locks and defeats traps
// (vendor/wwn-srd/1.0 Character Creation/1.2.0 Skills.md); gear moves a check within -2 to +2
// (vendor/wwn-srd/2.0 The Rules of the Game/2.3.0 Skill Checks.md, 2.3.1).
import type { LockState } from '../../data/schemas/index.ts';
import { attemptDisarm, attemptLock, type LockMethod } from '../../rules/locks.ts';
import type { GameData } from '../character/context.ts';
import { blind, carried } from '../dungeon/light.ts';
import { trapHarm, type TrapHarm } from '../dungeon/traps.ts';
import { alive, bestAt, memberCheck, note } from './members.ts';
import type { Member, World } from './types.ts';

export type Work = LockMethod | 'disarm';

const able = (w: World) => alive(w).filter((m) => !m.reviving && m.character.hp.current > 0);

const SKILL = {
  pick: { skill: 'sneak', attrs: ['dex' as const] },
  disarm: { skill: 'sneak', attrs: ['dex' as const] },
  force: { skill: 'exert', attrs: ['str' as const] },
};

/** The member best at a way of working a lock. */
export function handFor(w: World, data: GameData, method: Work): Member | undefined {
  const { skill, attrs } = SKILL[method];
  return bestAt(data, able(w), skill, attrs);
}

/** The bonus the party's gear gives a way of working a lock. */
export function gearBonus(w: World, data: GameData, method: Work): number {
  const { tools, crowbar } = data.content.chests;
  if (method === 'force') return carried(w, crowbar.item) > 0 ? crowbar.bonus : 0;
  return carried(w, tools.item) > 0 ? 0 : tools.without;
}

/** The difficulty to spot and disarm a lock's trap. */
export const trapDifficulty = (data: GameData, l: LockState) =>
  l.difficulty + (l.heavy ? data.content.chests.heavy.difficulty : 0);

/** Why the party can't work a lock now, or null if it can. */
export function cannotWork(w: World, data: GameData): string | null {
  if (w.encounter) return 'Settle the encounter first.';
  if (blind(w, data)) return 'It is too dark to work.';
  if (able(w).length === 0) return 'No one is fit to work.';
  return null;
}

/** A trap still set: neither disarmed nor sprung. */
export const armed = (l: LockState) =>
  l.trap !== null && (l.trapState === 'hidden' || l.trapState === 'noticed');

/**
 * The party's one look at a lock, if it can see: its best Wis/Notice against the trap's difficulty
 * spots the trap, or with `stirs` something alive inside.
 */
export function lookOver(
  w: World,
  data: GameData,
  l: LockState,
  what: string,
  stirs = false,
): void {
  if (l.looked || blind(w, data)) return;
  l.looked = true;
  if (!l.trap && !stirs) return;
  const eyes = bestAt(data, able(w), 'notice', ['wis']);
  const target = trapDifficulty(data, l);
  if (!eyes || !memberCheck(w, data, eyes, 'notice', ['wis'], target).success) return;
  l.trapState = 'noticed';
  const name = eyes.character.name;
  if (l.trap) note(w, `${name} spots a ${l.trap.name} on the ${what}.`);
  else note(w, `${name} sees the ${what} stir.`);
}

function spring(w: World, data: GameData, l: LockState): void {
  const trap = l.trap as NonNullable<LockState['trap']>;
  l.trapState = 'sprung';
  note(w, `The ${trap.name} springs!`);
  const e = trap.effect;
  const times = l.heavy ? data.content.chests.heavy.damage : 1;
  const harm: TrapHarm =
    e.kind === 'damage'
      ? { ...trap, effect: { ...e, dice: { ...e.dice, count: e.dice.count * times } } }
      : trap;
  trapHarm(w, data, harm);
}

function check(w: World, data: GameData, method: Work, difficulty: number) {
  const { skill, attrs } = SKILL[method];
  const hand = handFor(w, data, method) as Member;
  const r = memberCheck(w, data, hand, skill, attrs, difficulty, 0, gearBonus(w, data, method));
  return { hand, success: r.success, missedBy: Math.max(0, difficulty - r.score) };
}

/** The best Dex/Sneak works the spotted trap; true if one was there to work. */
export function disarmLock(w: World, data: GameData, l: LockState): boolean {
  if (l.trapState !== 'noticed' || !l.trap) return false;
  const { hand, success, missedBy } = check(w, data, 'disarm', trapDifficulty(data, l));
  const result = attemptDisarm(success, missedBy);
  if (result === 'disarmed') {
    l.trapState = 'disarmed';
    note(w, `${hand.character.name} disarms the ${l.trap.name}.`);
  } else if (result === 'sprung') {
    note(w, `${hand.character.name} fumbles the ${l.trap.name}.`);
    spring(w, data, l);
  } else note(w, `${hand.character.name} can't work out the ${l.trap.name}.`);
  return true;
}

/** One try at picking or forcing the lock, springing its trap as it may; true if it opens. */
export function tryLock(
  w: World,
  data: GameData,
  l: LockState,
  what: string,
  method: LockMethod,
  verbs = { force: 'force', forces: 'forces' },
): boolean {
  const { hand, success, missedBy } = check(w, data, method, l.difficulty);
  const { opens, springs } = attemptLock({ method, success, missedBy, armed: armed(l) });
  const name = hand.character.name;
  if (method === 'force')
    note(
      w,
      opens
        ? `${name} ${verbs.forces} the ${what} open.`
        : `${name} can't ${verbs.force} the ${what} open.`,
    );
  else note(w, `${name} ${opens ? 'picks' : "can't pick"} the ${what}'s lock.`);
  if (springs) spring(w, data, l);
  return opens;
}

/** A new lock: its difficulty, and a trap drawn from the content's kinds, or none. */
export function newLock(
  w: World,
  data: GameData,
  difficulty: number,
  trapped: boolean,
  heavy = false,
): LockState {
  const traps = data.content.chests.traps;
  return {
    difficulty,
    trap: trapped ? (traps[w.rng.int(0, traps.length - 1)] as LockState['trap']) : null,
    trapState: 'hidden',
    looked: false,
    heavy,
  };
}
