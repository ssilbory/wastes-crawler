// Arena fight sessions: battle setup from the picker screens, and the state the fight screens keep
// between the player's commands. The game layer does all the rules; this file only sequences them.
import type { DefaultPreset } from '../../data/schemas/index.ts';
import type { RosterEntry } from '../../game/character/roster.ts';
import {
  advance,
  awaitsRescue,
  concludeBattle,
  createBattle,
  type BattleResult,
} from '../../game/combat/battle.ts';
import { defaultAction } from '../../game/combat/defaults.ts';
import type { Action, Battle, Combatant } from '../../game/combat/types.ts';
import { createRng } from '../../rules/rng.ts';
import { data, freshRng } from '../builder/data.ts';

export interface PartySlot {
  entry: RosterEntry;
  row: number;
  column: number;
}

export type FightSetup =
  | { kind: 'party'; party: PartySlot[]; enemies: string[][]; seed: string }
  | { kind: 'spectator'; left: string[][]; right: string[][]; seed: string };

const rngFor = (seed: string) => (seed.trim() ? createRng(seed.trim()) : freshRng());
const rows = (r: string[][]) => r.filter((row) => row.length > 0);

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
}

const snapshot = (b: Battle) => new Map(b.combatants.map((c) => [c.id, `${c.hp}:${c.status}`]));

/** Runs some turns and reports what changed, concluding the battle once it is settled. */
export function batch(
  b: Battle,
  run: () => void,
): { changes: Changes; result: BattleResult | null } {
  const before = snapshot(b);
  const logFrom = b.log?.length ?? 0;
  run();
  const after = snapshot(b);
  const ids = new Set([...after].filter(([id, v]) => before.get(id) !== v).map(([id]) => id));
  // A win waits while healing magic could still save someone, so the player can choose.
  const done = b.outcome !== null && !awaitsRescue(b);
  return { changes: { logFrom, ids }, result: done ? concludeBattle(b) : null };
}

const isPc = (c: Combatant) => c.kind === 'pc';

/** Party fights: the PC awaiting a command, after every turn that needs none. */
export const nextCommand = (b: Battle) => advance(b, isPc);

export interface Presets {
  preset: (id: string) => DefaultPreset;
  last: Map<string, Action>;
}

export function presetAction(b: Battle, actor: Combatant, p: Presets): Action {
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
