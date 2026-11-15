// Locked doors (docs/rules-adaptation.md, Locks and chests; Sam's calls). A locked door, `l` on the
// map, stops the party until it is picked or broken down; it stays open for the rest of the visit
// and is locked again on the next, as a disarmed trap is set again. Its lock is worked as a chest's
// (world/lockwork.ts), and one in six is trapped. Breaking it down is loud: each try brings the
// level's wanderers on 2 in 6. A door's difficulty is the shipped ruin's 7 + level / 2, else 8
// (vendor/wwn-srd/2.0 The Rules of the Game/2.3.0 Skill Checks.md, 2.3.1). Each try takes a turn
// (vendor/wwn-srd/2.0 The Rules of the Game/2.13.0 Dungeon Exploration.md).
import type { DoorState } from '../../data/schemas/index.ts';
import { lockDifficulty, type LockMethod } from '../../rules/locks.ts';
import type { Cell, Facing } from '../../rules/grid.ts';
import type { GameData } from '../character/context.ts';
import { cannotWork, disarmLock, lookOver, newLock, tryLock } from '../world/lockwork.ts';
import { note } from '../world/members.ts';
import type { TownResult } from '../world/services.ts';
import type { World } from '../world/types.ts';
import { ruinOfDungeon } from './hidden-ruins.ts';
import { levelOf } from './levels.ts';
import { edgeKey } from './secrets.ts';
import { callWanderers, passTurn } from './time.ts';

const OK: TownResult = { ok: true };
const no = (reason: string): TownResult => ({ ok: false, reason });
const state = (w: World) => w.dungeon as NonNullable<World['dungeon']>;

/** The party's record of a locked door this visit, if it has reached it. */
function record(w: World, key: string): DoorState | undefined {
  const s = state(w);
  return s.doors?.[s.level]?.[key];
}

/** Whether a door on a cell's side is locked and not yet opened this visit. */
export function lockedAt(w: World, data: GameData, c: Cell, side: Facing): boolean {
  const s = w.dungeon;
  if (!s) return false;
  const { map } = levelOf(data, s.dungeon, s.level);
  if (!map.inBounds(c) || !map.locked(c, side)) return false;
  return record(w, edgeKey(c, side))?.opened !== true;
}

/** The locked door straight ahead, as the party knows it so far, or null for none. */
export function lockedDoorAhead(w: World, data: GameData): { known: DoorState | null } | null {
  const s = w.dungeon;
  if (!s || !lockedAt(w, data, s.at, s.facing)) return null;
  return { known: record(w, edgeKey(s.at, s.facing)) ?? null };
}

/** The difficulty of a locked door here: the shipped ruin's, else the content's default. */
function difficulty(w: World, data: GameData): number {
  const rules = data.content.chests;
  const ruin = ruinOfDungeon(data, state(w).dungeon);
  return ruin && data.content.ruins.includes(ruin)
    ? lockDifficulty(rules.difficulty, ruin.level)
    : rules.doors.difficulty;
}

/**
 * The locked door ahead, reached: its lock and trap set the first time, and looked over once.
 * Callers check that a locked door is ahead.
 */
export function reachDoor(w: World, data: GameData): DoorState {
  const s = state(w);
  const key = edgeKey(s.at, s.facing);
  let door = record(w, key);
  if (!door) {
    const trapped = w.rng.int(1, data.content.chests.doors.trappedIn) === 1;
    door = { ...newLock(w, data, difficulty(w, data), trapped), opened: false };
    s.doors = { ...s.doors, [s.level]: { ...s.doors?.[s.level], [key]: door } };
  }
  lookOver(w, data, door, 'door');
  return door;
}

function blocked(w: World, data: GameData): string | null {
  if (!w.dungeon) throw new Error('the party is not in a dungeon');
  if (!lockedDoorAhead(w, data)) return 'There is no locked door ahead.';
  return cannotWork(w, data);
}

/** A turn spent on the spotted trap on the door ahead. */
export function disarmDoor(w: World, data: GameData): TownResult {
  const why = blocked(w, data);
  if (why) return no(why);
  const door = reachDoor(w, data);
  if (!disarmLock(w, data, door)) return no('No trap has been found on it.');
  passTurn(w, data);
  return OK;
}

/** A turn spent picking the door's lock, or breaking it down, which may bring the wanderers. */
export function openDoor(w: World, data: GameData, method: LockMethod): TownResult {
  const why = blocked(w, data);
  if (why) return no(why);
  const door = reachDoor(w, data);
  const verbs = { force: 'break', forces: 'breaks' };
  door.opened = tryLock(w, data, door, 'door', method, verbs) !== null;
  if (method === 'force' && w.rng.int(1, 6) <= data.content.chests.doors.noise) {
    note(w, 'The noise carries through the halls.');
    callWanderers(w, data);
  }
  passTurn(w, data);
  return OK;
}

/** Why a step through a door is refused: it is locked. Reaching it sets and looks it over. */
export function lockedStep(w: World, data: GameData, way: Facing): string | null {
  const s = state(w);
  if (!lockedAt(w, data, s.at, way)) return null;
  if (way === s.facing) reachDoor(w, data);
  return 'The door is locked.';
}
