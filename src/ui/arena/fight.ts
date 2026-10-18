// Arena fight sessions: battle setup from the picker screens, and the state the fight screens keep
// between the player's commands. The game layer does all the rules; this file only sequences them.
import type { DefaultPreset } from '../../data/schemas/index.ts';
import type { RosterEntry } from '../../game/character/roster.ts';
import {
  advance,
  awaitsMending,
  awaitsRescue,
  concludeBattle,
  createBattle,
  type BattleResult,
} from '../../game/combat/battle.ts';
import { monsterAction } from '../../game/combat/ai.ts';
import { answersCall } from '../../game/combat/companions.ts';
import { defaultAction } from '../../game/combat/defaults.ts';
import type { Action, Battle, Combatant } from '../../game/combat/types.ts';
import { floats, type Float } from '../../render/fight-fx.ts';
import { createRng } from '../../rules/rng.ts';
import { data, freshRng } from '../builder/data.ts';
import type { Rival } from './RivalPicker.tsx';

export interface PartySlot {
  entry: RosterEntry;
  row: number;
  column: number;
}

export type FightSetup =
  | { kind: 'party'; party: PartySlot[]; enemies: string[][]; rivals: Rival[]; seed: string }
  | { kind: 'spectator'; left: string[][]; right: string[][]; seed: string };

const rngFor = (seed: string) => (seed.trim() ? createRng(seed.trim()) : freshRng());
const rows = (r: string[][]) => r.filter((row) => row.length > 0);

/** Rivals named like a party member get " (rival)", so the log tells them apart. */
function named(rivals: Rival[], party: PartySlot[]): Rival[] {
  const taken = new Set(party.map((p) => p.entry.character.name));
  return rivals.map((r) =>
    taken.has(r.character.name)
      ? { ...r, character: { ...r.character, name: `${r.character.name} (rival)` } }
      : r,
  );
}

export function startBattle(setup: FightSetup): Battle {
  if (setup.kind === 'party') {
    return createBattle({
      data,
      rng: rngFor(setup.seed),
      party: setup.party.map((p) => ({
        character: p.entry.character,
        row: p.row,
        column: p.column,
      })),
      enemies: rows(setup.enemies),
      rivals: named(setup.rivals, setup.party),
      log: true,
    });
  }
  return createBattle({
    data,
    rng: rngFor(setup.seed),
    party: [],
    allies: rows(setup.left),
    enemies: rows(setup.right),
    sideNames: { party: 'the left side', enemy: 'the right side' },
    log: true,
  });
}

/** What changed in the last batch of turns, for highlighting. */
export interface Changes {
  /** Index of the first new log line. */
  logFrom: number;
  /** Combatants whose HP or status changed. */
  ids: Set<string>;
  /** The numbers to float over each slot. */
  floats: Map<string, Float[]>;
}

const snapshot = (b: Battle) => new Map(b.combatants.map((c) => [c.id, `${c.hp}:${c.status}`]));

/** Runs some turns and reports what changed, concluding the battle once it is settled. */
export function batch(
  b: Battle,
  run: () => void,
): { changes: Changes; result: BattleResult | null } {
  const before = snapshot(b);
  const hpBefore = new Map(b.combatants.map((c) => [c.id, c.hp]));
  const logFrom = b.log?.length ?? 0;
  const eventsFrom = b.events?.length ?? 0;
  run();
  const after = snapshot(b);
  const ids = new Set([...after].filter(([id, v]) => before.get(id) !== v).map(([id]) => id));
  // A win waits while healing magic could still save someone, or mend the wounded, so the
  // player can choose.
  const done = b.outcome !== null && !awaitsRescue(b) && !awaitsMending(b);
  return {
    changes: { logFrom, ids, floats: floats(b, eventsFrom, hpBefore) },
    result: done ? concludeBattle(b) : null,
  };
}

/** The party's PCs take commands, and a companion answering its master's Mind Call (1.5.4). */
const commanded = (b: Battle) => (c: Combatant) =>
  (c.kind === 'pc' && c.side === 'party') || answersCall(b, c);

/** Party fights: the combatant awaiting a command, after every turn that needs none. */
export const nextCommand = (b: Battle) => advance(b, commanded(b));

export interface Presets {
  preset: (id: string) => DefaultPreset;
  last: Map<string, Action>;
}

export function presetAction(b: Battle, actor: Combatant, p: Presets): Action {
  // A companion left to itself fights as its stat line would (1.5.4).
  if (actor.kind !== 'pc' && p.preset(actor.id) === 'auto') return monsterAction(b, actor);
  return defaultAction(b, actor, p.preset(actor.id), p.last.get(actor.id) ?? null);
}

/** Auto-combat: every PC follows its default preset to the end of the fight. */
export function autoResolve(b: Battle, p: Presets): void {
  advance(
    b,
    () => false,
    (battle, actor) => presetAction(battle, actor, p),
  );
}
