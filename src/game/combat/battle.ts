// Setting up a battle (vendor/wwn-srd/2.0 The Rules of the Game/2.4.0 Combat.md): the party's
// formation or a second side of monster rows, the enemy rows, and side initiative (2.4.1).
import type { Character } from '../../data/schemas/index.ts';
import { partyActsFirst, sideInitiative } from '../../rules/combat.ts';
import { ROW_SLOTS } from '../../rules/formation.ts';
import type { Rng } from '../../rules/rng.ts';
import type { GameData } from '../character/context.ts';
import { pcCombatant } from './combatants.ts';
import { lifted } from './companions.ts';
import { monsterCombatant } from './monster-combatant.ts';
import { say } from './damage.ts';
import { beginRound } from './round.ts';
import { canAct } from './targeting.ts';
import { followRiders } from './mounted.ts';
import type { Battle, Combatant, SideId, WaitingCompanion } from './types.ts';

export { act } from './actions.ts';
export {
  advance,
  beginRound,
  currentActor,
  holdTurn,
  MAX_ROUNDS,
  runRound,
  takeTurn,
} from './round.ts';
export {
  awaitsMending,
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
  /** A fighting servant (raised undead, a beast, a woken tree, or a kept summons). */
  servant?: boolean;
  /** A Beastmaster's companion: its master's index in the party, and its arts' gifts (1.5.4). */
  companion?: { master: number; chosen: boolean; shared: boolean; hitDice: number };
  /** Carries this party index, fighting from their slot (docs/rules-adaptation.md, Mounts). */
  rider?: number;
}

/** A war mount fighting from its rider's slot (docs/rules-adaptation.md, Mounts). */
export interface MountSetup {
  monster: string;
  name: string;
  /** The rider's index in `party`. */
  rider: number;
  hp: number;
  maxHp: number;
  /** Rider: the rider's AC when higher than the mount's own. */
  ac?: number;
  /** Rider level 2: once a fight, a blow that would drop the mount is negated. */
  guard?: boolean;
}

export { DARK_HIT_MODIFIER } from './targeting.ts';

export interface BattleSetup {
  data: GameData;
  rng: Rng;
  /** PCs fill the front row left to right, then the rear, unless a slot is given. */
  party: {
    character: Character;
    row?: number;
    column?: number;
    form?: number | null;
    /** May bind a beast among the foes: holds Bind Companion and has no companion (1.5.4). */
    canBind?: boolean;
    /** A companion sent away, which a Howl of Distant Summons can bring in (1.5.4). */
    waiting?: WaitingCompanion | null;
  }[];
  /** Monster rows on the party's side, front first, for monster-vs-monster fights. */
  allies?: string[][];
  /** NPCs in the party's formation: hirelings and captives (docs/rules-adaptation.md). */
  npcs?: NpcSetup[];
  /** War mounts under PCs in `party`, after the NPCs among the combatants. */
  mounts?: MountSetup[];
  /** Enemy rows, front first: up to three rows of up to eight monster ids. */
  enemies: string[][];
  /** Characters in place of monsters, in formation (docs/rules-adaptation.md, Arena rivals). */
  rivals?: { character: Character; row: number; column: number }[];
  /** Names for the log; the party and the enemy by default. */
  sideNames?: Record<SideId, string>;
  /** The party fights without light (docs/rules-adaptation.md, Dungeon exploration). */
  dark?: boolean;
  /** No one can cast spells or use arts: an anti-magic square. */
  antiMagic?: boolean;
  /** Underground, where Deluge of Hell can't be cast. */
  indoors?: boolean;
  /** Someone on the party's side can talk to animals, so beasts can surrender (Phase 19). */
  talksToBeasts?: boolean;
  log?: boolean;
}

/**
 * A character side's initiative: its PCs' best Dex modifier and best Alert bonus. Only PCs count:
 * hirelings, mounts, companions and summons have no Dex of their own (their modifiers are all 0),
 * so they'd lift a side of clumsy PCs to +0.
 */
export function initiativeModifiers(side: readonly Combatant[]): { dex: number; bonus: number } {
  const pcs = side.filter((c) => c.kind === 'pc' && canAct(c));
  return {
    dex: pcs.length > 0 ? Math.max(...pcs.map((p) => p.modifiers.dex)) : 0,
    bonus: Math.max(0, ...pcs.map((p) => p.initiativeBonus)),
  };
}

/** An NPC's stat line; a companion's with Shared Vitality's hit dice and hit bonus (1.5.4). */
function npcCombatant(s: BattleSetup, n: NpcSetup, i: number): Combatant {
  const c = monsterCombatant(s.data, n.monster, `npc-${i}`, s.rng);
  if (!n.companion) return c;
  const { master, chosen, shared, hitDice } = n.companion;
  return {
    ...c,
    ...lifted(c, { hitDice, shared }),
    companion: { master: `pc-${master}`, chosen, shared },
  };
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

function mountCombatant(s: BattleSetup, m: MountSetup, i: number): Combatant {
  const c = monsterCombatant(s.data, m.monster, `mount-${i}`, s.rng);
  return {
    ...c,
    name: m.name,
    side: 'party',
    hp: m.hp,
    maxHp: m.maxHp,
    ac: Math.max(c.ac, m.ac ?? 0),
    status: m.hp > 0 ? 'active' : 'dead',
    rider: `pc-${m.rider}`,
    steedGuard: m.guard ?? false,
  };
}

export function createBattle(s: BattleSetup): Battle {
  const npcs = s.npcs ?? [];
  const slotted = npcs.filter((n) => n.rider === undefined);
  if (s.party.length + slotted.length > 2 * ROW_SLOTS)
    throw new Error('at most eight party members');
  const allies = s.allies ?? [];
  if (s.party.length + npcs.length > 0 && allies.length > 0) {
    throw new Error('a side is either characters or monsters');
  }
  checkRows(allies);
  checkRows(s.enemies);
  const party: Combatant[] = [
    ...s.party.map((p, i) => ({
      ...pcCombatant(s.data, p.character, `pc-${i}`, p.form ?? null),
      row: p.row ?? Math.floor(i / ROW_SLOTS),
      column: p.column ?? i % ROW_SLOTS,
      canBind: p.canBind ?? false,
      waiting: p.waiting ?? null,
    })),
    ...npcs.map((n, i) => ({
      ...npcCombatant(s, n, i),
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
      servant: n.servant ?? false,
      ...(n.rider === undefined ? {} : { rider: `pc-${n.rider}` }),
    })),
    ...(s.mounts ?? []).map((m, i) => mountCombatant(s, m, i)),
    ...monsterRows(s, allies, 'party', 'ally'),
  ];
  followRiders(party);
  const rivals = s.rivals ?? [];
  if (rivals.length > 2 * ROW_SLOTS) throw new Error('at most eight rivals');
  if (rivals.length > 0 && s.enemies.some((r) => r.length > 0))
    throw new Error('a side is either characters or monsters');
  const slots = new Set(rivals.map((p) => `${p.row}-${p.column}`));
  if (
    slots.size < rivals.length ||
    rivals.some((p) => p.row < 0 || p.row > 1 || p.column < 0 || p.column >= ROW_SLOTS)
  )
    throw new Error('rivals stand one to a slot in two rows of four');
  const enemies =
    rivals.length > 0
      ? rivals.map((p, i) => ({
          ...pcCombatant(s.data, p.character, `foe-pc-${i}`),
          side: 'enemy' as const,
          row: p.row,
          column: p.column,
        }))
      : monsterRows(s, s.enemies, 'enemy', 'foe');
  if (s.antiMagic)
    for (const c of [...party, ...enemies])
      if (c.caster) Object.assign(c.caster, { canCast: false, armorFree: [] });
  const b: Battle = {
    data: s.data,
    rng: s.rng,
    round: 1,
    combatants: [...party, ...enemies],
    layout: {
      party: allies.length > 0 ? 'rows' : 'formation',
      enemy: rivals.length > 0 ? 'formation' : 'rows',
    },
    sideNames: s.sideNames ?? { party: 'the party', enemy: 'the enemy' },
    partyFirst: true,
    queue: [],
    heldThisRound: new Set(),
    turnBegun: null,
    rowsChecked: new Set(),
    boss: null,
    talksToBeasts: { party: s.talksToBeasts ?? false, enemy: false },
    halfChecked: new Set(),
    startCount: { party: party.length, enemy: enemies.length },
    stabilizedThisRound: new Set(),
    dark: s.dark ?? false,
    indoors: s.indoors ?? false,
    walls: [],
    fury: null,
    everlasting: null,
    vines: null,
    escaped: false,
    mended: false,
    log: s.log ? [] : null,
    logSides: s.log ? [] : null,
    acting: null,
    events: s.log ? [] : null,
    outcome: null,
  };
  // Characters roll with their best Dex and Alert; monsters roll flat.
  const pcRoll = (side: Combatant[]) => {
    const { dex, bonus } = initiativeModifiers(side);
    return sideInitiative(s.rng, dex, bonus);
  };
  const partyRoll = pcRoll(party);
  const enemyRoll = rivals.length > 0 ? pcRoll(enemies) : sideInitiative(s.rng, 0);
  b.partyFirst = partyActsFirst(partyRoll, enemyRoll);
  const winner = b.partyFirst ? b.sideNames.party : b.sideNames.enemy;
  say(b, `${winner.charAt(0).toUpperCase()}${winner.slice(1)} wins initiative.`);
  beginRound(b);
  return b;
}
