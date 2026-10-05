// Faction goals and experience (vendor/wwn-srd/6.0 Factions/Creating Factions.md, Example Faction
// Goals; The Faction Turn.md). Each faction works through its content's goals in order. A goal
// that can no longer be met is abandoned, costing the next turn's action. Experience raises the
// faction's attributes in its content's order, one step at a time.
import type { FactionGoalKind, FactionState } from '../../data/schemas/index.ts';
import { bloodTarget, factionMaxHp, raiseCost, rootOutDifficulty } from '../../rules/factions.ts';
import type { GameData } from '../character/context.ts';
import type { World } from '../world/types.ts';
import { factionOf, isActive, locationName, news, ratings } from './state.ts';

/** Turns without an Attack for Peaceable Kingdom. */
export const PEACEABLE_TURNS = 4;

export const GOAL_NAMES: Record<FactionGoalKind, string> = {
  'blood-the-enemy': 'Blood the Enemy',
  'root-out': 'Root Out the Enemy',
  'peaceable-kingdom': 'Peaceable Kingdom',
};

/** The weakest Base of Influence among the faction's active rivals. */
export function weakestBase(w: World, data: GameData, id: string) {
  const bases = factionOf(data, id).enemies.flatMap((e) => {
    const s = w.factions[e];
    return isActive(s) ? s.bases.map((b) => ({ faction: e, at: b.at, hp: b.hp })) : [];
  });
  if (bases.length === 0) return null;
  const weakest = bases.reduce((a, b) => (b.hp < a.hp ? b : a));
  return { faction: weakest.faction, at: weakest.at };
}

/** Takes the next goal in the list from `from`, skipping a Root Out with no rival base left. */
export function pickGoal(w: World, data: GameData, id: string, from: number): void {
  const goals = factionOf(data, id).goals;
  const s = w.factions[id] as FactionState;
  for (let i = 0; i < goals.length; i++) {
    const index = (from + i) % goals.length;
    const kind = goals[index] as FactionGoalKind;
    const target = kind === 'root-out' ? weakestBase(w, data, id) : null;
    if (kind === 'root-out' && !target) continue;
    s.goal = { kind, target, progress: 0 };
    s.goalIndex = index;
    return;
  }
  // Nobody left to root out: the faction keeps the peace.
  s.goal = { kind: 'peaceable-kingdom', target: null, progress: 0 };
}

function difficulty(w: World, s: FactionState): number {
  const goal = s.goal as NonNullable<FactionState['goal']>;
  if (goal.kind === 'blood-the-enemy') return 2;
  if (goal.kind === 'peaceable-kingdom') return 1;
  const ruler = w.factions[(goal.target as { faction: string }).faction] as FactionState;
  return rootOutDifficulty(ratings(ruler));
}

/** Spends experience on the first attribute in the faction's order that can still rise. */
function spendXp(data: GameData, id: string, s: FactionState): void {
  const f = factionOf(data, id);
  const attribute = f.raise.find((a) => raiseCost(s[a]) !== null);
  if (!attribute) return;
  const cost = raiseCost(s[attribute]) as number;
  if (s.xp < cost) return;
  const before = factionMaxHp(ratings(s));
  s.xp -= cost;
  s[attribute] += 1;
  const gain = factionMaxHp(ratings(s)) - before;
  s.hp += gain;
  const hq = s.bases.find((b) => b.at === f.hq);
  if (hq) Object.assign(hq, { hp: hq.hp + gain, max: hq.max + gain });
  spendXp(data, id, s);
}

/**
 * The end of a faction's turn: a met goal pays its experience and the next one starts; a goal that
 * can't be met any more is dropped for the next, at the cost of the next turn's action. Returns
 * whether a goal was met.
 */
export function checkGoal(w: World, data: GameData, id: string, attacked: boolean): boolean {
  const s = w.factions[id] as FactionState;
  const goal = s.goal as NonNullable<FactionState['goal']>;
  const name = factionOf(data, id).name;
  if (goal.kind === 'peaceable-kingdom') goal.progress = attacked ? 0 : goal.progress + 1;
  const met =
    goal.kind === 'blood-the-enemy'
      ? goal.progress >= bloodTarget(ratings(s))
      : goal.kind === 'peaceable-kingdom'
        ? goal.progress >= PEACEABLE_TURNS
        : goal.progress >= 1;
  if (met) {
    s.xp += difficulty(w, s);
    news(w, `${name} achieves its goal, ${GOAL_NAMES[goal.kind]}.`);
    pickGoal(w, data, id, s.goalIndex + 1);
    spendXp(data, id, s);
    return true;
  }
  const target = goal.target;
  if (target && !w.factions[target.faction]?.bases.some((b) => b.at === target.at)) {
    news(w, `${name} gives up on ${locationName(data, target.at)}.`);
    s.idle = true;
    pickGoal(w, data, id, s.goalIndex + 1);
  }
  return false;
}
