// The combat round (vendor/wwn-srd/2.0 The Rules of the Game/2.4.1–2.4.2): sides act in initiative
// order, then the end-of-round formation shifts, mortal-wound clock, and condition timers from
// docs/rules-adaptation.md and 2.5.1. Turns run one at a time, so a caller can stop for a player's
// command (advance) or let controllers decide everything (runRound, runBattle).
import { freeShift, mayShiftFree } from './forms.ts';
import { actsOnInstinct, MORTAL_ROUNDS } from '../../rules/combat.ts';
import { frontDrops, ROW_SLOTS, type Formation, type FormationRow } from '../../rules/formation.ts';
import { act } from './actions.ts';
import { monsterAction, partyAction } from './ai.ts';
import { freeActions } from './free-actions.ts';
import { say } from './damage.ts';
import { echoes, landing, quickens, roundPasses, struggle, weakestSwing } from './conditions.ts';
import { checkMorale } from './morale.ts';
import { canAct, isUp, targets } from './targeting.ts';
import type { Action, Attack, Battle, Combatant, Controller, SideId } from './types.ts';
import { followRiders, inSlot } from './mounted.ts';
import { endCharms, raiseTheDead, throwOffCharms } from './charm.ts';
import { bound, squeeze, startTurn, tearFree } from './creature-specials.ts';
import { heedCall } from './companions.ts';

export const MAX_ROUNDS = 100;

/** Actions that take the whole Main Action, however many attacks a monster has. */
const MAIN_ONLY = new Set<Action['kind']>(['cast', 'breath', 'gaze', 'web', 'self-heal']);

const order = (list: Combatant[]) => [...list].sort((x, y) => x.row - y.row || x.column - y.column);

/** Queues this round's turns: Alert 2 PCs first, rivals' too, then each side in initiative order. */
export function beginRound(b: Battle): void {
  const pcs = order(b.combatants.filter((c) => c.side === 'party'));
  const foes = order(b.combatants.filter((c) => c.side === 'enemy'));
  const first = (b.partyFirst ? [...pcs, ...foes] : [...foes, ...pcs]).filter((c) => c.actsFirst);
  const later = (side: Combatant[]) => side.filter((c) => !c.actsFirst);
  const sides = b.partyFirst ? [later(pcs), later(foes)] : [later(foes), later(pcs)];
  // Slow creatures, such as zombies, always act last (Phase 14a).
  const turns = [...first, ...sides.flat()];
  b.queue = [...turns.filter((c) => !c.actsLast), ...turns.filter((c) => c.actsLast)].map(
    (c) => c.id,
  );
  b.heldThisRound.clear();
}

/**
 * Holds the current actor's turn until right after `after`'s, someone still to act this round
 * (docs/rules-adaptation.md, Holding; SRD 2.4.4 Hold An Action). Once a round; false when it
 * can't be done.
 */
export function holdTurn(b: Battle, actor: Combatant, after: string): boolean {
  const at = b.queue.indexOf(after);
  const target = b.combatants.find((c) => c.id === after);
  if (b.queue[0] !== actor.id || b.heldThisRound.has(actor.id) || at <= 0 || !target) return false;
  b.queue.splice(at + 1, 0, actor.id);
  b.queue.shift();
  b.heldThisRound.add(actor.id);
  b.turnBegun = null;
  say(b, `${actor.name} holds, waiting on ${target.name}.`);
  return true;
}

function checkEnd(b: Battle): void {
  // The Invincible Citadel ends the fight as a break-off, whoever is left standing.
  if (b.escaped) return;
  // The banished and the howled who will find their way back keep the fight going (Phase 18a).
  // The charmed fight for the other side for now (Phase 19).
  const left = (c: Combatant) => (canAct(c) || c.returnsRound > 0) && !c.charm;
  if (!b.combatants.some((c) => c.side === 'enemy' && left(c))) b.outcome = 'party';
  else if (!b.combatants.some((c) => c.side === 'party' && left(c) && !c.noncombatant))
    b.outcome = 'enemy';
  // Whatever is said once the fight is settled is no one's turn; charms end with the fight.
  if (!b.outcome) return;
  b.acting = null;
  endCharms(b);
}

/**
 * The combatant whose turn it is, or null when the round's turns are done. Skips anyone who can no
 * longer act, and spends a stunned combatant's turn.
 */
export function currentActor(b: Battle): Combatant | null {
  while (b.queue.length > 0 && !b.outcome) {
    const actor = b.combatants.find((c) => c.id === b.queue[0]) as Combatant;
    if (!canAct(actor)) {
      b.queue.shift();
      continue;
    }
    // Webs and a hug take the turn for struggling (Phase 19).
    const caught = bound(b, actor);
    if (!actor.stunned && !caught) return actor;
    b.queue.shift();
    actor.totalDefense = false;
    b.acting = actor.side;
    if (!actor.stunned) {
      tearFree(b, actor);
      continue;
    }
    actor.stunned = false;
    say(b, `${actor.name} is stunned and loses the action.`);
  }
  return null;
}

/** Starts the actor's turn: Total Defense ends, and On Turn free actions happen first. */
function beginTurn(b: Battle, actor: Combatant): void {
  b.acting = actor.side;
  if (b.turnBegun === actor.id) return;
  b.turnBegun = actor.id;
  actor.totalDefense = false;
  startTurn(b, actor);
  // Wind Walking's mist can't cast (4.5.0). A held turn took its On Turn actions before holding.
  if (!actor.misted && !b.heldThisRound.has(actor.id)) freeActions(b, actor);
}

/** Plays the current actor's turn: free actions, then one action (monsters: one per attack). */
export function takeTurn(b: Battle, actor: Combatant, controller: Controller): void {
  beginTurn(b, actor);
  // An On Turn change of form leaves the turn with the actor, to choose its Main Action (1.5.15).
  const first = mayShiftFree(b, actor) ? controller(b, actor) : null;
  if (first && freeShift(b, actor, first)) {
    act(b, actor, first);
    return;
  }
  b.queue.shift();
  b.turnBegun = null;
  struggle(b, actor);
  // Compel Flesh's struggle can kill the last of a side.
  checkEnd(b);
  const plan = swingPlan(b, actor);
  for (let i = 0; i < plan.length && canAct(actor) && !b.outcome; i++) {
    actor.forcedAttack = plan[i] as number | null;
    const action = i === 0 && first ? first : controller(b, actor);
    actor.forcedAttack = null;
    act(b, actor, action);
    checkMorale(b);
    checkEnd(b);
    // Casting, breathing, a gaze, webs, or a heal is the Main Action, whatever the monster's number
    // of attacks.
    if (MAIN_ONLY.has(action.kind)) break;
  }
  quickened(b, actor, controller);
}

/**
 * Resounding Temporal Echo's extra Main Action: an attack, never magic (4.4.0). The one the
 * controller asks for if it can land, else a swing at the weakest foe in reach; strain is paid
 * only when there is a swing to make.
 */
function quickened(b: Battle, actor: Combatant, controller: Controller): void {
  if (!quickens(b, actor)) return;
  const swing = landing(b, actor, controller(b, actor)) ?? weakestSwing(b, actor);
  if (!swing || !echoes(b, actor)) return;
  act(b, actor, swing);
  checkMorale(b);
  checkEnd(b);
}

/**
 * The attack each swing of a turn must use: a monster's routine, or its volley in the first round
 * or when the routine can reach no one (Phase 14a); otherwise its best attack, once per attack it
 * has (a PC: once).
 */
function swingPlan(b: Battle, actor: Combatant): (number | null)[] {
  const { routine, volley } = actor;
  if (routine) {
    const reach = (i: number) => targets(b, actor, actor.attacks[i] as Attack).length > 0;
    // A volley softens the party up in the first round, or serves when nothing is in reach.
    return volley && (b.round === 1 || !reach(routine[0] as number)) ? volley : routine;
  }
  return Array<null>(actor.kind === 'monster' ? actor.attacksPerRound : 1).fill(null);
}

function formation(b: Battle, side: SideId): Formation {
  const grid: Formation = [Array(ROW_SLOTS).fill(null), Array(ROW_SLOTS).fill(null)];
  for (const c of b.combatants) {
    if (c.side !== side || !inSlot(c)) continue;
    // Non-combatants hold their slot but are never promoted to the front.
    const standing = canAct(c) && !c.noncombatant;
    // Only the downed drop back: the held, the asleep, and the frozen keep their place.
    const down = c.status === 'dying' || c.status === 'stable' || c.status === 'dead';
    (grid[c.row] as FormationRow)[c.column] = { standing, down };
  }
  return grid;
}

/** HP ties for promotion are decided at random (docs/rules-adaptation.md, Promotion). */
const pickAtRandom = (b: Battle) => (cols: number[]) =>
  cols[b.rng.int(0, cols.length - 1)] as number;

function shiftFormation(b: Battle, side: SideId): void {
  const members = b.combatants.filter((c) => c.side === side && inSlot(c));
  const at = (row: number, col: number) => members.find((c) => c.row === row && c.column === col);
  const rearHp = [0, 1, 2, 3].map((col) => at(1, col)?.hp ?? 0);
  for (const move of frontDrops(formation(b, side), rearHp, pickAtRandom(b))) {
    // frontDrops only moves occupied front slots.
    const down = at(...move.from) as Combatant;
    const other = at(...move.to);
    [down.row, down.column] = move.to;
    if (other) [other.row, other.column] = move.from;
  }
  followRiders(b.combatants);
}

export function endOfRound(b: Battle): void {
  b.acting = null;
  for (const c of b.combatants) {
    // Time stands still for the frozen in amber (4.4.0).
    if (c.status === 'dying' && !c.amber && b.round - c.fellRound >= MORTAL_ROUNDS) {
      c.status = 'dead';
      say(b, `${c.name} dies of their wounds.`);
    }
    c.shieldUsed = false;
    c.instinctive = false;
    if (c.blindRounds > 0) c.blindRounds -= 1;
    if (c.heldRounds > 0) c.heldRounds -= 1;
    if (c.wardRounds > 0) c.wardRounds -= 1;
    if (c.rootedRounds > 0) c.rootedRounds -= 1;
    if (c.flyingRounds > 0) c.flyingRounds -= 1;
  }
  for (const side of ['party', 'enemy'] as const)
    if (b.layout[side] === 'formation') shiftFormation(b, side);
  // Monster rows step up when their front row is empty. A monster held out of action (spellbound,
  // banished and due back) still holds its slot, so only the dead and the fled leave it open.
  const monsters = b.combatants.filter((c) => c.kind === 'monster' && isUp(c));
  const gone = (c: Combatant) => c.status === 'dead' || c.status === 'fled';
  for (const side of ['party', 'enemy'] as const) {
    if (b.layout[side] !== 'rows') continue;
    const frontHeld = () =>
      b.combatants.some((c) => c.kind === 'monster' && c.side === side && c.row === 0 && !gone(c));
    // Petrifying Stare's rooted stay where they stand (Phase 15).
    const movers = monsters.filter((c) => c.side === side && c.rootedRounds === 0);
    while (movers.length > 0 && !frontHeld()) for (const e of movers) e.row -= 1;
  }
  squeeze(b);
  throwOffCharms(b);
  raiseTheDead(b);
  b.stabilizedThisRound.clear();
  b.round += 1;
  roundPasses(b);
  // The Fury, a lapsing Forgetting the Grave, and the like can settle the fight between rounds.
  if (!b.outcome) checkEnd(b);
  // SRD 5.4.2: the second round of a fight tests the nerve of mobs and undisciplined fighters.
  if (b.round === 2) {
    for (const m of monsters)
      if (canAct(m) && actsOnInstinct(b.rng, m.instinct)) m.instinctive = true;
  }
  beginRound(b);
}

/** Ends the round once every turn is taken; past the round limit the fight is a draw. */
function closeRound(b: Battle): void {
  b.acting = null;
  checkEnd(b);
  if (b.outcome) return;
  endOfRound(b);
  if (b.round > MAX_ROUNDS) b.outcome = 'draw';
}

/** The charmed are played as monsters are, never by the player (Phase 19). */
const controllerFor = (c: Combatant, party: Controller, enemy: Controller) =>
  c.kind === 'pc' && !c.charm ? party : enemy;

/**
 * Plays turns until one needs a player's command, returning that combatant, or null once the
 * battle has an outcome. PCs use `party` and monsters `enemy` when they decide for themselves.
 */
export function advance(
  b: Battle,
  needsCommand: (c: Combatant) => boolean,
  party: Controller = partyAction,
  enemy: Controller = monsterAction,
): Combatant | null {
  while (!b.outcome) {
    const actor = currentActor(b);
    if (!actor) closeRound(b);
    else if (needsCommand(actor) && !actor.charm) {
      beginTurn(b, actor);
      // A companion under its master's command has had Mind Call's Effort committed (1.5.4).
      if (actor.companion) heedCall(b, actor);
      return actor;
    } else takeTurn(b, actor, controllerFor(actor, party, enemy));
  }
  return null;
}

/** Plays the rest of the current round with controllers deciding every turn. */
export function runRound(
  b: Battle,
  party: Controller = partyAction,
  enemy: Controller = monsterAction,
): void {
  for (let actor = currentActor(b); actor; actor = currentActor(b))
    takeTurn(b, actor, controllerFor(actor, party, enemy));
  closeRound(b);
}
