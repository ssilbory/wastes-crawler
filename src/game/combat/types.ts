// Battle state for the combat engine. The engine mutates a Battle it owns; callers get it back
// from runBattle or step through it round by round.
import type { ArmorClassInput } from '../../rules/armor-class.ts';
import type {
  Attribute,
  AttackMode,
  Character,
  Dice,
  Element,
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
  /** Arts that work even when armor blocks casting (a Priest of Death's Healer arts, Phase 14d). */
  armorFree: string[];
  /** Uses of limited arts since the last quarter of rest, by art id (Phase 15). */
  uses: Record<string, number>;
  /** No spells through this round: Retain Sorcery's stress, or Swift Casting's spell (Phase 15). */
  castLock: number;
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
  /** Phase 14c: Armor of God's natural AC (0 if none), and Wrath's pending extra damage. */
  acFloor: number;
  /** A PC's armor, shield, and Dex, so a natural AC still takes Dex and a shield; null for monsters. */
  acInput: ArmorClassInput | null;
  wrath: { until: number; bonus: number } | null;
  /** A PC's character, whose gear can be readied or stowed mid-fight (Phase 17); null otherwise. */
  character: Character | null;
  /** Phase 14d: Final Repose's Physical save penalty for the scene. */
  reposePenalty: number;
  /**
   * Phase 15 arts: sight that ignores darkness, Sanctified Ward, an intelligent creature (for Red
   * Harvest), Petrifying Stare's rounds rooted, Steps of Air's rounds aloft, Red Harvest's next-hit
   * bonus and the round it last fed, Cold Flesh's Shock cap, and Unaging's immunity to poison.
   */
  seesInDark: boolean;
  sanctified: boolean;
  sapient: boolean;
  rootedRounds: number;
  flyingRounds: number;
  nextHitBonus: number;
  harvestRound: number;
  shockCap: number | null;
  poisonImmune: boolean;
  /** Pact of Stone and Sea: breath of this element can't harm it. */
  pact: Element | null;
  /**
   * Phase 18a High Magic: Mantle of Disjecting Dissection's blades, Resounding Temporal Echo's last
   * round and strain, the Torment of Tumefaction, a spell holding the creature out
   * of the fight that dispelling ends, the round a banished creature returns (0 for never), the
   * Prismatic Hemicycle's madness, the hit points and strain Prudentially Transient Abnegation of
   * Life brings it back with, blows that only knock foes out, and who summoned it as which monster.
   */
  mantle: { bonus: number; damage: Dice; save: SaveType } | null;
  echo: { until: number; strain: number } | null;
  torment: { damage: number; lasting: boolean; tried: boolean; round: number } | null;
  spellbound: boolean;
  returnsRound: number;
  berserk: boolean;
  revives: { hp: number; strain: number } | null;
  subdues: boolean;
  summoned: { by: string; monster: string } | null;
  /** A fighting servant from the world: raised undead, a beast, a woken tree, or a kept summons. */
  servant: boolean;
  /**
   * Phase 18b Elementalist magic: Flame Without End's extra damage on a hit, Like the Stones'
   * points ignored from each harm, and Wind Walking's mist.
   */
  flame: number;
  stone: number;
  misted: boolean;
  /**
   * Phase 18c Necromancer magic: Augment Mortal Vitality's save bonus and unspent healing, the last
   * round Enfeebling Wave hinders it, Compel Flesh's damage per struggle (0 for none), the last
   * round Forgetting the Grave keeps it from dying, the ally Merge Souls pools it with, and the
   * last round Call of the Tomb dooms it.
   */
  vitality: { saveBonus: number; healReady: boolean } | null;
  enfeebledUntil: number;
  compelled: number;
  deathlessUntil: number;
  mergedWith: string | null;
  doomedUntil: number;
  /**
   * Phase 18d magic: frozen by The Long Amber Moment, fleet with Velocitous Imbuement, and cursed by
   * Final Death.
   */
  amber: boolean;
  fleet: boolean;
  finalDeath: boolean;
}

export type Action =
  | { kind: 'attack'; attack: number; target: string; smite?: true }
  | { kind: 'cast'; magic: string; target?: string; row?: number; strain?: boolean }
  | { kind: 'breath'; row: number }
  | { kind: 'total-defense' }
  | { kind: 'stabilize'; target: string }
  | { kind: 'move'; row: number; column: number }
  | { kind: 'gear'; item: number; location: 'readied' | 'stowed' }
  /** Spend the Main Action trying to throw off the Torment of Tumefaction. */
  | { kind: 'shake-off' }
  /** Spend the Main Action taking form again out of Wind Walking's mist. */
  | { kind: 'end-mist' }
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
  /** Attack roll modifier by side, from God Wills It. */
  hitModifier: Record<SideId, number>;
  /** The party fights without light; those who don't see in the dark take -4 to hit. */
  dark: boolean;
  /** The fight is underground, where Deluge of Hell can't be cast. */
  indoors: boolean;
  /**
   * Elemental Vallation's walls (Phase 18b): each burns, once, every foe of `side` that crosses
   * it to strike in melee; and Fury of the Elements, wandering the foe's rows.
   */
  walls: { side: SideId; damage: Dice; bonus: number; crossed: string[] }[];
  fury: { side: SideId; row: number; damage: Dice; roundsLeft: number } | null;
  /** Everlasting (Phase 18c): no one on `side` drops below 1 HP through `until`; then the caster. */
  everlasting: { side: SideId; caster: string; until: number } | null;
  /** The Verdant Vallation (Phase 18d): vines `side` must cut through, `hp` left, to strike in melee. */
  vines: { side: SideId; hp: number } | null;
  /** The party escaped behind the Invincible Citadel (Phase 18d): the fight broke off. */
  escaped: boolean;
  /** The player is done healing the wounded after the fight (Sam's call). */
  mended: boolean;
  /** God Wills It's bonus to damage and Shock, by side (Phase 14c). */
  damageBonus: Record<SideId, number>;
  log: string[] | null;
  outcome: Outcome | null;
}

/** Chooses an action for a combatant on its turn. */
export type Controller = (battle: Battle, actor: Combatant) => Action;
