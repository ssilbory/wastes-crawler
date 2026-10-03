// Exploration time underground (vendor/wwn-srd/2.0 The Rules of the Game/2.13.0 Dungeon
// Exploration.md; docs/rules-adaptation.md, Dungeon exploration): 12 steps of 10 feet make a
// ten-minute turn (2.13.3, 120 feet a turn), 36 turns make a quarter day, and the level's wandering
// check comes every so many turns (2.13.5). The light burns each turn. A fight takes a turn and the
// first aid and looting after it another (2.13.2).
import { encounterCheck } from '../../rules/overland.ts';
import type { GameData } from '../character/context.ts';
import { rollEnemies, startEncounter } from '../world/encounters.ts';
import { alive, bestAt, note, restQuarter } from '../world/members.ts';
import { endQuarter } from '../world/quarter.ts';
import type { Activity, World } from '../world/types.ts';
import { levelOf } from './explore.ts';
import { burn, inDark } from './light.ts';

export const STEPS_PER_TURN = 12;
export const TURNS_PER_QUARTER = 36;
/** SRD 2.13.5: a wandering encounter on a 1 in 6. */
const WANDER_DIE = 6;

const state = (w: World) => w.dungeon as NonNullable<World['dungeon']>;

/** The level's wandering encounter check: a 1 in 6, met by the party's best Wis/Notice. */
function wander(w: World, data: GameData): void {
  const s = state(w);
  const { level } = levelOf(data, s.dungeon, s.level);
  if (!level.wander || w.encounter) return;
  if (s.turn % level.wander.every !== 0) return;
  if (!encounterCheck(w.rng, WANDER_DIE)) return;
  const able = alive(w).filter((m) => m.character.hp.current > 0);
  const watcher = bestAt(data, able, 'notice', ['wis']);
  const rolled = rollEnemies(w, data, level.wander.table);
  // In the dark no one can spot them first.
  startEncounter(
    w,
    data,
    rolled,
    watcher,
    inDark(w) ? null : 0,
    `${level.name} ${s.at.x},${s.at.y}`,
  );
}

/** One exploration turn: the light burns, the calendar moves on every 36th, then the check. */
export function passTurn(w: World, data: GameData): void {
  const s = state(w);
  s.turn += 1;
  burn(w);
  if (s.turn % TURNS_PER_QUARTER === 0) endQuarter(w, data);
  wander(w, data);
}

/** A step counts toward the turn. */
export function countStep(w: World, data: GameData): void {
  const s = state(w);
  s.steps += 1;
  if (s.steps < STEPS_PER_TURN) return;
  s.steps = 0;
  passTurn(w, data);
}

/** After a fight underground: the light burns for it, then the fight's turn and the one after. */
export function fightTurns(w: World, data: GameData): void {
  burn(w);
  passTurn(w, data);
  passTurn(w, data);
}

export const onSafeSquare = (w: World, data: GameData) => {
  const s = w.dungeon;
  if (!s) return false;
  return levelOf(data, s.dungeon, s.level).level.safe.some((c) => c.x === s.at.x && c.y === s.at.y);
};

export type CampResult = { ok: true } | { ok: false; reason: string };

/**
 * A quarter day camped on a safe square: rest and sleep as on the overland map, sheltered, with one
 * wandering check at the level's odds. The light isn't burned: only exploration turns count. An
 * encounter breaks the camp before the quarter passes.
 */
export function campUnderground(
  w: World,
  data: GameData,
  activities: Record<string, Extract<Activity, 'rest' | 'sleep' | 'watch'>>,
): CampResult {
  if (!w.dungeon) throw new Error('the party is not in a dungeon');
  if (w.encounter) return { ok: false, reason: 'Settle the encounter first.' };
  if (!onSafeSquare(w, data)) return { ok: false, reason: 'This is no place to camp.' };
  const doing = (a: Activity) => alive(w).filter((m) => activities[m.id] === a);
  for (const m of [...doing('rest'), ...doing('sleep')]) restQuarter(m);
  for (const m of doing('sleep')) m.slept = true;
  w.camp = 'made';
  note(w, 'The party camps.');
  const s = state(w);
  const { level } = levelOf(data, s.dungeon, s.level);
  if (level.wander && encounterCheck(w.rng, WANDER_DIE)) {
    const watcher = doing('watch')[0];
    const rolled = rollEnemies(w, data, level.wander.table);
    startEncounter(
      w,
      data,
      rolled,
      watcher,
      inDark(w) ? null : 0,
      `${level.name} ${s.at.x},${s.at.y}`,
    );
    return { ok: true };
  }
  endQuarter(w, data);
  return { ok: true };
}
