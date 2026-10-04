// Battle state for the combat engine. The engine mutates a Battle it owns; callers get it back
// from runBattle or step through it round by round.
import type {
  Attribute,
  AttackMode,
  Dice,
  MonsterCombat,
  MonsterTag,
  OnHit,
} from '../../data/schemas/index.ts';
import type { ShockRating } from '../../rules/attacks.ts';
import type { Rng } from '../../rules/rng.ts';
import type { SaveType } from '../../rules/saves.ts';
import type { StrainState } from '../../rules/strain.ts';
import type { GameData } from '../character/context.ts';

export type SideId = 'party' | 'enemy';

/** One way a combatant can attack, with every bonus already folded in. */
export interface Attack {
  id: string;
  name: string;
  mode: AttackMode;
  /** Total to add to the d20. */
  hit: number;
  damage: Dice;
  damageBonus: number;
  /** Melee only; a null maxAc applies whatever the target's AC. */
  shock: ShockRating | null;
  /** Can melee from the second row (the L trait, or a reach creature). */
  reach: boolean;
  twoHanded: boolean;
  /** A crushing weapon, for creatures that shrug off blunt blows (Phase 14a). */
  blunt: boolean;
  /** Poison or paralysis on a hit (Phase 14a). */
  onHit: OnHit | null;
}

export interface CasterState {
  level: number;
  effortMax: number;
  effortUsed: number;
  /** Effort spent for the day, part of effortUsed; it carries over to later fights that day. */
  effortDay: number;
  spellsLeft: number;
  prepared: string[];
  known: string[];
  arts: string[];
  magicSkill: number;
  /** Best of Int or Cha, for spells; Elemental Blast may also use Dex. */
  castModifier: number;
  canCast: boolean;
  /** Arts and spells already used this scene, and targets of once-per-target ones. */
  usedThisScene: Set<string>;
}

export type Status = 'active' | 'asleep' | 'dying' | 'stable' | 'dead' | 'fled' | 'out';

export interface Combatant {
  id: string;
  name: string;
  side: SideId;
  kind: 'pc' | 'monster';
  /** Formation: row 0 front, 1 rear, column 0–3. Monster rows: row 0–2, any column. */
  row: number;
  column: number;
  /** A monster's starting row, which keeps its Morale group as rows advance. */
  group: number;
  hp: number;
  maxHp: number;
  ac: number;
  attacks: Attack[];
  attacksPerRound: number;
  saves: Record<SaveType, number>;
  /** Monster hit dice, or PC character level. */
  hitDice: number;
  /** Attribute modifiers, Developed Attribute included; all 0 for monsters. */
  modifiers: Record<Attribute, number>;
  skills: Record<string, number>;
  /** Monster skill bonus, used for opposed checks. */
  skillBonus: number;
  healModifier: number;
  hasHealKit: boolean;
  tags: Set<MonsterTag>;
  morale: number;
  instinct: number;
  shield: boolean;
  towerShield: boolean;
  meleeShockImmune: boolean;
  /** Deadeye: hit modifier for two-handed ranged attacks in melee, or null if not allowed. */
  rangedInMelee: number | null;
  initiativeBonus: number;
  actsFirst: boolean;
  killingBlow: boolean;
  veteransLuck: boolean;
  caster: CasterState | null;
  strain: StrainState | null;
  status: Status;
  frail: boolean;
  /** The round a PC fell, for the six-round death clock and stabilize difficulty; set by harm. */
  fellRound: number;
  /** Per-round and lasting conditions. */
  totalDefense: boolean;
  shieldUsed: boolean;
  stunned: boolean;
  instinctive: boolean;
  blindRounds: number;
  wardRounds: number;
  acBonus: number;
  /** A captive or non-combat hireling: never attacks, targeted only when no one else can be. */
  noncombatant: boolean;
  /**
   * Phase 14a: a monster's routine and volley as indices into its attacks, the attack its current
   * swing must use, its breath weapon and the uses left this fight, rounds it is held paralyzed,
   * its resistances, and whether it always acts last.
   */
  routine: number[] | null;
  volley: number[] | null;
  forcedAttack: number | null;
  breath: NonNullable<MonsterCombat['breath']> | null;
  breathLeft: number;
  heldRounds: number;
  resist: NonNullable<MonsterCombat['resist']> | null;
  actsLast: boolean;
}

export type Action =
  | { kind: 'attack'; attack: number; target: string }
  | { kind: 'cast'; magic: string; target?: string; row?: number; strain?: boolean }
  | { kind: 'breath'; row: number }
  | { kind: 'total-defense' }
  | { kind: 'stabilize'; target: string }
  | { kind: 'move'; row: number; column: number }
  | { kind: 'wait' };

export type Outcome = 'party' | 'enemy' | 'draw';

/**
 * How a side stands: the party's two rows of four (docs/rules-adaptation.md, Formation rules), or
 * monster rows of up to eight, which advance when the front row empties.
 */
export type Layout = 'formation' | 'rows';

export interface Battle {
  data: GameData;
  rng: Rng;
  round: number;
  combatants: Combatant[];
  layout: Record<SideId, Layout>;
  /** Names used in the log, such as "the party" or "the enemy". */
  sideNames: Record<SideId, string>;
  partyFirst: boolean;
  /** Ids still to act this round, in turn order. */
  queue: string[];
  /** The combatant whose turn has started and awaits a command, if any. */
  turnBegun: string | null;
  /** Monster rows (`side:group`) that have taken their first loss and rolled for it. */
  rowsChecked: Set<string>;
  /** Sides that have rolled Morale for losing half their number. */
  halfChecked: Set<SideId>;
  /** Each side's starting number of combatants. */
  startCount: Record<SideId, number>;
  stabilizedThisRound: Set<string>;
  /** Attack roll modifier by side: -4 for a party fighting in the dark (docs/rules-adaptation.md). */
  hitModifier: Record<SideId, number>;
  log: string[] | null;
  outcome: Outcome | null;
}

/** Chooses an action for a combatant on its turn. */
export type Controller = (battle: Battle, actor: Combatant) => Action;
