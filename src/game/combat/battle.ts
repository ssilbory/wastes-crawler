// Setting up a battle (vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md): the party's
// formation or a second side of monster rows, the enemy rows, and side initiative (2.4.1).
import type { Character } from '../../data/schemas/index.ts';
import { partyActsFirst, sideInitiative } from '../../rules/combat.ts';
import { ROW_SLOTS } from '../../rules/formation.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { pcCombatant } from './combatants.ts';
import { monsterCombatant } from './monster-combatant.ts';
import { say } from './damage.ts';
import { beginRound } from './round.ts';
import { canAct } from './targeting.ts';
import type { Battle, Combatant, SideId } from './types.ts';

export { act } from './actions.ts';
export { advance, beginRound, currentActor, MAX_ROUNDS, runRound, takeTurn } from './round.ts';
export {
  awaitsRescue,
  concludeBattle,
  runBattle,
  type BattleResult,
  type Rescue,
} from './aftermath.ts';

/** An NPC fighting from a formation slot, as its SRD stat line. */
export interface NpcSetup {
  monster: string;
  name: string;
  row: number;
  column: number;
  /** Current hit points, carried in from the world. */
  hp: number;
  maxHp: number;
  noncombatant: boolean;
  /** Tends the dying with this total Heal bonus and a healer's kit (SRD 3.3.0 common hirelings). */
  healer?: number;
}

export { DARK_HIT_MODIFIER } from './targeting.ts';

export interface BattleSetup {
  data: GameData;
  rng: Rng;
  /** PCs fill the front row left to right, then the rear, unless a slot is given. */
  party: { character: Character; row?: number; column?: number }[];
  /** Monster rows on the party's side, front first, for monster-vs-monster fights. */
  allies?: string[][];
  /** NPCs in the party's formation: hirelings and captives (docs/rules-adaptation.md). */
  npcs?: NpcSetup[];
  /** Enemy rows, front first: up to three rows of up to eight monster ids. */
  enemies: string[][];
  /** Names for the log; the party and the enemy by default. */
  sideNames?: Record<SideId, string>;
  /** The party fights without light (docs/rules-adaptation.md, Dungeon exploration). */
  dark?: boolean;
  /** No one can cast spells or use arts: an anti-magic square. */
  antiMagic?: boolean;
  log?: boolean;
}

function checkRows(rows: string[][]): void {
  if (rows.length > 3 || rows.some((r) => r.length > 8)) {
    throw new Error('monsters stand in up to three rows of up to eight');
  }
}

function monsterRows(s: BattleSetup, rows: string[][], side: SideId, prefix: string): Combatant[] {
  return rows.flatMap((row, r) =>
    row.map((id, column) => ({
      ...monsterCombatant(s.data, id, `${prefix}-${r}-${column}`, s.rng),
      side,
      row: r,
      column,
      group: r,
    })),
  );
}

export function createBattle(s: BattleSetup): Battle {
  const npcs = s.npcs ?? [];
  if (s.party.length + npcs.length > 2 * ROW_SLOTS) throw new Error('at most eight party members');
  const allies = s.allies ?? [];
  if (s.party.length + npcs.length > 0 && allies.length > 0) {
    throw new Error('a side is either characters or monsters');
  }
  checkRows(allies);
  checkRows(s.enemies);
  const party: Combatant[] = [
    ...s.party.map((p, i) => ({
      ...pcCombatant(s.data, p.character, `pc-${i}`),
      row: p.row ?? Math.floor(i / ROW_SLOTS),
      column: p.column ?? i % ROW_SLOTS,
    })),
    ...npcs.map((n, i) => ({
      ...monsterCombatant(s.data, n.monster, `npc-${i}`, s.rng),
      name: n.name,
      side: 'party' as const,
      row: n.row,
      column: n.column,
      hp: n.hp,
      maxHp: n.maxHp,
      status: n.hp > 0 ? ('active' as const) : ('dead' as const),
      noncombatant: n.noncombatant,
      healModifier: n.healer ?? 0,
      hasHealKit: n.healer !== undefined,
    })),
    ...monsterRows(s, allies, 'party', 'ally'),
  ];
  const enemies = monsterRows(s, s.enemies, 'enemy', 'foe');
  if (s.antiMagic)
    for (const c of [...party, ...enemies])
      if (c.caster) Object.assign(c.caster, { canCast: false, armorFree: [] });
  const b: Battle = {
    data: s.data,
    rng: s.rng,
    round: 1,
    combatants: [...party, ...enemies],
    layout: { party: allies.length > 0 ? 'rows' : 'formation', enemy: 'rows' },
    sideNames: s.sideNames ?? { party: 'the party', enemy: 'the enemy' },
    partyFirst: true,
    queue: [],
    turnBegun: null,
    rowsChecked: new Set(),
    halfChecked: new Set(),
    startCount: { party: party.length, enemy: enemies.length },
    stabilizedThisRound: new Set(),
    hitModifier: { party: 0, enemy: 0 },
    dark: s.dark ?? false,
    damageBonus: { party: 0, enemy: 0 },
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
  const winner = b.partyFirst ? b.sideNames.party : b.sideNames.enemy;
  say(b, `${winner.charAt(0).toUpperCase()}${winner.slice(1)} wins initiative.`);
  beginRound(b);
  return b;
}
