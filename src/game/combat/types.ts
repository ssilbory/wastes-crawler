// Battle state for the combat engine. The engine mutates a Battle it owns; callers get it back
// from runBattle or step through it round by round.
import type { Attribute, AttackMode, Dice, MonsterTag } from '../../data/schemas/index.ts';
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
}

export interface CasterState {
  level: number;
  effortMax: number;
  effortUsed: number;
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
  /** Party: row 0 front, 1 rear, column 0–3. Enemies: row 0–2, any column. */
  row: number;
  column: number;
  /** An enemy's starting row, which keeps its Morale group as rows advance. */
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
}

export type Action =
  | { kind: 'attack'; attack: number; target: string }
  | { kind: 'cast'; magic: string; target?: string; row?: number; strain?: boolean }
  | { kind: 'total-defense' }
  | { kind: 'stabilize'; target: string }
  | { kind: 'move'; row: number; column: number }
  | { kind: 'wait' };

export type Outcome = 'party' | 'enemy' | 'draw';

export interface Battle {
  data: GameData;
  rng: Rng;
  round: number;
  combatants: Combatant[];
  partyFirst: boolean;
  /** Enemy rows that have taken their first loss and rolled for it. */
  rowsChecked: Set<number>;
  halfChecked: boolean;
  enemyStart: number;
  stabilizedThisRound: Set<string>;
  log: string[] | null;
  outcome: Outcome | null;
}

/** Chooses an action for a combatant on its turn. */
export type Controller = (battle: Battle, actor: Combatant) => Action;
