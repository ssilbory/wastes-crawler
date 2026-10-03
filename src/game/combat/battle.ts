// The combat sequence (vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md, 2.4.1–2.4.2): side
// initiative, sides acting in turn, morale, and the end-of-round formation shifts, mortal-wound
// clock, and condition timers from docs/rules-adaptation.md and 2.5.1.
import type { Character } from '../../data/schemas/index.ts';
import { skillCheck } from '../../rules/checks.ts';
import {
  actsOnInstinct,
  MORTAL_ROUNDS,
  partyActsFirst,
  sideInitiative,
  stabilizeDifficulty,
} from '../../rules/combat.ts';
import { frontDrops, ROW_SLOTS, type Formation, type FormationRow } from '../../rules/formation.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { freeActions, monsterAction, partyAction } from './ai.ts';
import { resolveAttack } from './attack.ts';
import { monsterCombatant, pcCombatant } from './combatants.ts';
import { say } from './damage.ts';
import { checkMorale } from './morale.ts';
import { castMagic } from './spells.ts';
import { canAct, isUp, targets } from './targeting.ts';
import type { Action, Battle, Combatant, Controller, Outcome } from './types.ts';

export const MAX_ROUNDS = 100;

export interface BattleSetup {
  data: GameData;
  rng: Rng;
  /** PCs fill the front row left to right, then the rear, unless a slot is given. */
  party: { character: Character; row?: number; column?: number }[];
  /** Enemy rows, front first: up to three rows of up to eight monster ids. */
  enemies: string[][];
  log?: boolean;
}

export function createBattle(s: BattleSetup): Battle {
  if (s.party.length > 2 * ROW_SLOTS) throw new Error('at most eight party members');
  if (s.enemies.length > 3 || s.enemies.some((r) => r.length > 8)) {
    throw new Error('enemies stand in up to three rows of up to eight');
  }
  const party = s.party.map((p, i) => ({
    ...pcCombatant(s.data, p.character, `pc-${i}`),
    row: p.row ?? Math.floor(i / ROW_SLOTS),
    column: p.column ?? i % ROW_SLOTS,
  }));
  const enemies = s.enemies.flatMap((row, r) =>
    row.map((id, column) => ({
      ...monsterCombatant(s.data, id, `foe-${r}-${column}`, s.rng),
      row: r,
      column,
      group: r,
    })),
  );
  const b: Battle = {
    data: s.data,
    rng: s.rng,
    round: 1,
    combatants: [...party, ...enemies],
    partyFirst: true,
    rowsChecked: new Set(),
    halfChecked: false,
    enemyStart: enemies.length,
    stabilizedThisRound: new Set(),
    log: s.log ? [] : null,
    outcome: null,
  };
  const active = party.filter(canAct);
  const partyRoll = sideInitiative(
    s.rng,
    Math.max(0, ...active.map((p) => p.modifiers.dex)),
    Math.max(0, ...active.map((p) => p.initiativeBonus)),
  );
  b.partyFirst = partyActsFirst(partyRoll, sideInitiative(s.rng, 0));
  say(b, b.partyFirst ? 'The party wins initiative.' : 'The enemy wins initiative.');
  return b;
}

function stabilize(b: Battle, actor: Combatant, target: Combatant): void {
  if (target.status !== 'dying' || b.stabilizedThisRound.has(target.id)) return;
  b.stabilizedThisRound.add(target.id);
  const check = skillCheck(b.rng, {
    skill: actor.skills.heal ?? null,
    attributeModifier: actor.healModifier,
    difficulty: stabilizeDifficulty(b.round - target.fellRound, actor.hasHealKit),
  });
  if (!check.success) return;
  target.status = 'stable';
  target.frail = true;
  say(b, `${actor.name} stabilizes ${target.name}.`);
}

export function act(b: Battle, actor: Combatant, action: Action): void {
  const target = 'target' in action ? b.combatants.find((c) => c.id === action.target) : undefined;
  switch (action.kind) {
    case 'attack': {
      const attack = actor.attacks[action.attack];
      if (attack && target && targets(b, actor, attack).includes(target))
        resolveAttack(b, actor, attack, target);
      return;
    }
    case 'cast':
      castMagic(b, actor, action.magic, action.target, action.row, action.strain);
      return;
    case 'total-defense':
      actor.totalDefense = true;
      return;
    case 'stabilize':
      if (target && target.side === actor.side) stabilize(b, actor, target);
      return;
    case 'move': {
      const taken = b.combatants.some(
        (c) => c.side === actor.side && c.row === action.row && c.column === action.column,
      );
      if (actor.side === 'party' && !taken && action.row >= 0 && action.row <= 1) {
        actor.row = action.row;
        actor.column = action.column;
      }
      return;
    }
    case 'wait':
      return;
  }
}

function checkEnd(b: Battle): void {
  if (!b.combatants.some((c) => c.side === 'enemy' && canAct(c))) b.outcome = 'party';
  else if (!b.combatants.some((c) => c.side === 'party' && canAct(c))) b.outcome = 'enemy';
}

function turn(b: Battle, actor: Combatant, controller: Controller): void {
  if (!canAct(actor) || b.outcome) return;
  actor.totalDefense = false;
  if (actor.stunned) {
    actor.stunned = false;
    say(b, `${actor.name} is stunned and loses the action.`);
    return;
  }
  if (actor.kind === 'pc') freeActions(b, actor);
  const swings = actor.kind === 'monster' ? actor.attacksPerRound : 1;
  for (let i = 0; i < swings && canAct(actor) && !b.outcome; i++) {
    act(b, actor, controller(b, actor));
    checkMorale(b);
    checkEnd(b);
  }
}

function formation(b: Battle): Formation {
  const grid: Formation = [Array(ROW_SLOTS).fill(null), Array(ROW_SLOTS).fill(null)];
  for (const c of b.combatants) {
    if (c.side !== 'party') continue;
    (grid[c.row] as FormationRow)[c.column] = { standing: canAct(c), down: !canAct(c) };
  }
  return grid;
}

/** HP ties for promotion are decided at random (docs/rules-adaptation.md, Promotion). */
const pickAtRandom = (b: Battle) => (cols: number[]) =>
  cols[b.rng.int(0, cols.length - 1)] as number;

function endOfRound(b: Battle): void {
  for (const c of b.combatants) {
    if (c.status === 'dying' && b.round - c.fellRound >= MORTAL_ROUNDS) {
      c.status = 'dead';
      say(b, `${c.name} dies of their wounds.`);
    }
    c.shieldUsed = false;
    c.instinctive = false;
    if (c.blindRounds > 0) c.blindRounds -= 1;
    if (c.wardRounds > 0) c.wardRounds -= 1;
  }
  const party = b.combatants.filter((c) => c.side === 'party');
  const at = (row: number, col: number) => party.find((c) => c.row === row && c.column === col);
  const rearHp = [0, 1, 2, 3].map((col) => at(1, col)?.hp ?? 0);
  for (const move of frontDrops(formation(b), rearHp, pickAtRandom(b))) {
    // frontDrops only moves occupied front slots.
    const down = at(...move.from) as Combatant;
    const other = at(...move.to);
    [down.row, down.column] = move.to;
    if (other) [other.row, other.column] = move.from;
  }
  // Enemy rows step up when the front row is empty.
  const enemies = b.combatants.filter((c) => c.side === 'enemy' && isUp(c));
  while (enemies.length > 0 && !enemies.some((e) => e.row === 0))
    for (const e of enemies) e.row -= 1;
  b.stabilizedThisRound.clear();
  b.round += 1;
  // SRD 5.4.2: the second round of a fight tests the nerve of mobs and undisciplined fighters.
  if (b.round === 2) {
    for (const e of enemies)
      if (canAct(e) && actsOnInstinct(b.rng, e.instinct)) e.instinctive = true;
  }
}

const order = (list: Combatant[]) => [...list].sort((x, y) => x.row - y.row || x.column - y.column);

export function runRound(
  b: Battle,
  party: Controller = partyAction,
  enemy: Controller = monsterAction,
): void {
  const pcs = order(b.combatants.filter((c) => c.side === 'party'));
  const foes = order(b.combatants.filter((c) => c.side === 'enemy'));
  const first = pcs.filter((c) => c.actsFirst);
  const rest = pcs.filter((c) => !c.actsFirst);
  const sides = b.partyFirst ? [rest, foes] : [foes, rest];
  for (const c of first) turn(b, c, party);
  for (const group of sides) for (const c of group) turn(b, c, c.side === 'party' ? party : enemy);
  checkEnd(b);
  if (!b.outcome) endOfRound(b);
}

const heal = (c: Combatant) => c.skills.heal ?? -1;

/** After a win, the party keeps trying to stabilize the dying until each lives or dies. */
function aftermath(b: Battle): void {
  while (b.combatants.some((c) => c.side === 'party' && c.status === 'dying')) {
    const medics = b.combatants.filter((c) => c.side === 'party' && canAct(c));
    for (const victim of b.combatants.filter((c) => c.side === 'party' && c.status === 'dying')) {
      const medic = medics.sort((x, y) => heal(y) - heal(x))[0];
      if (medic) stabilize(b, medic, victim);
    }
    endOfRound(b);
  }
}

export interface BattleResult {
  outcome: Outcome;
  rounds: number;
  deaths: number;
  battle: Battle;
}

export function runBattle(b: Battle, party?: Controller, enemy?: Controller): BattleResult {
  while (!b.outcome && b.round <= MAX_ROUNDS) runRound(b, party, enemy);
  const outcome: Outcome = b.outcome ?? 'draw';
  const rounds = Math.min(b.round, MAX_ROUNDS);
  if (outcome === 'party') aftermath(b);
  const deaths = b.combatants.filter((c) => c.side === 'party' && c.status === 'dead').length;
  return { outcome, rounds, deaths, battle: b };
}
