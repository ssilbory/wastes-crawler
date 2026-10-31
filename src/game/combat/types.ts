// Battle state for the combat engine. The engine mutates a Battle it owns; callers get it back
// from runBattle or step through it round by round.
import type { AbilityEffect } from '../../data/schemas/index.ts';
import type { ArmorClassInput } from '../../rules/armor-class.ts';
import type {
  Attribute,
  AttackMode,
  Character,
  Dice,
  Element,
  Mind,
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
  /** A magic weapon's special ability (SRD 4.9.3). */
  magic: AbilityEffect | null;
  /** The ammo a shot uses up, for a PC's bow, crossbow, or hurlant (Ammo). */
  ammo?: string | undefined;
}

export interface CasterState {
  level: number;
  effortMax: number;
  effortUsed: number;
  /** Effort spent for the day, part of effortUsed; it carries over to later fights that day. */
  effortDay: number;
  spellsLeft: number;
  /** The Invoker's spell points left today (1.5.11). */
  pointsLeft: number;
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
  /**
   * Phase 19: Move in feet (PCs 30, SRD 2.4.4), a monster's stat-line skill bonus (0 for PCs), its
   * kind of mind (people for PCs), and whether a row's failed Morale ended in surrender: such a
   * combatant has `fled` status, as one that escaped does.
   */
  move: number;
  skillBonus: number;
  mind: Mind;
  surrendered: boolean;
  /**
   * Phase 19 charm and possession: the charm on it (who cast it, and that one's side), the save
   * its own charming gaze allows, those it has gazed at this fight, a disease it brought into the
   * fight, and whether its corpse has risen.
   */
  charm: { by: string; side: SideId } | null;
  charmSave: SaveType | null;
  charmTried: string[];
  carries: string | null;
  rose: boolean;
  /**
   * Phase 19 creature specials: hit points regained each turn, webs not yet cast, the difficulty
   * a webbed creature tears free against (0 for none), a heal not yet used, a blink, a hug and
   * whose hug holds it, a strike that follows another more easily, and this turn's hits.
   */
  regenerate: number;
  webs: { save: SaveType; difficulty: number } | null;
  webbed: number;
  selfHeal: Dice | null;
  blink: boolean;
  hug: { strike: string; damage: Dice; penalty: number } | null;
  heldBy: string | null;
  followUp: { after: string; strike: string; hit: number } | null;
  turnHits: { strike: string; target: string }[];
  shield: boolean;
  towerShield: boolean;
  meleeShockImmune: boolean;
  /** Die Hard: falls to zero stable, not dying. */
  selfStabilize: boolean;
  /** Die Hard: today's one escape from an injury that would drop them, and whether it was spent. */
  lastStand: boolean;
  lastStandUsed: boolean;
  /** Deadeye: hit modifier for two-handed ranged attacks in melee, or null if not allowed. */
  rangedInMelee: number | null;
  /** The ammo this combatant has shot this fight, rolled for afterwards (Ammo). */
  shot: string[];
  initiativeBonus: number;
  actsFirst: boolean;
  veteransLuck: boolean;
  /** God Wills It's bonus to hit, damage, and Shock: the best blessing on them (Phase 14c). */
  blessed: number;
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
  /**
   * Lingering poison and disease (docs/rules-adaptation.md, Poison and disease): Poisoned, the
   * strain a venom owes once the fight is over, a disease caught in this fight, and the penalty
   * to hit and to skill checks the PC's ailments bring into it.
   */
  poisoned: boolean;
  venom: number;
  /** Health drain: the System Strain a PC owes once the fight is over (Sam's call). */
  drained: number;
  caught: string | null;
  ailPenalty: number;
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
  /** Oil of Edge on the weapon for the rest of the fight (docs/rules-adaptation.md, Potions). */
  edge: { hit: number; damage: number } | null;
  stone: number;
  misted: boolean;
  /** A Skinshifter's alternate form worn now, by index into the character's forms (1.5.15). */
  form: number | null;
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
  /**
   * A war mount's rider, by combatant id, whose slot it fights from; and the Rider focus's guard,
   * which once a fight negates a blow that would drop the mount (Mounts).
   */
  rider: string | null;
  steedGuard: boolean;
  /**
   * The Beastmaster (1.5.4): the monster stat line a creature fights as, and whether it is an
   * unintelligent beast; a companion's master (by combatant id), and whether it is their Chosen
   * Friend or shares their vitality; a foe bound mid-fight, by whom; whether a PC may still bind
   * one; a companion waiting out of the fight for a Howl of Distant Summons; Beast Ward on a PC; and
   * a beast that a ward no longer holds back.
   */
  monster: string | null;
  beast: boolean;
  companion: { master: string; chosen: boolean; shared: boolean } | null;
  bound: { by: string } | null;
  canBind: boolean;
  waiting: WaitingCompanion | null;
  beastWard: boolean;
  provoked: boolean;
  /** The Vowed's Mob Justice holding now: immune to Shock in melee with two foes or more (1.5.17). */
  mobJustice: boolean;
}

/** A Beastmaster's companion sent away before the fight, which a howl can bring into it. */
export interface WaitingCompanion {
  monster: string;
  name: string;
  hp: number;
  maxHp: number;
  hitDice: number;
  chosen: boolean;
  shared: boolean;
}

export type Action =
  | { kind: 'attack'; attack: number; target: string; smite?: true }
  | { kind: 'cast'; magic: string; target?: string; row?: number; strain?: boolean }
  | { kind: 'breath'; row: number }
  /** A charming gaze at one foe (Phase 19: Charm and possession). */
  | { kind: 'gaze'; target: string }
  /** Creature specials (Phase 19): webs cast at a foe, and a creature healing itself. */
  | { kind: 'web'; target: string }
  | { kind: 'self-heal' }
  | { kind: 'total-defense' }
  | { kind: 'stabilize'; target: string }
  /** Into an empty slot, or trading places with the ally in it (docs/rules-adaptation.md, Swapping). */
  | { kind: 'move'; row: number; column: number }
  /** Hold the turn until right after the named combatant's (Holding); see holdTurn. */
  | { kind: 'hold'; after: string }
  | { kind: 'gear'; item: number; location: 'readied' | 'stowed' }
  /** Drink a readied potion, or give it to an ally in touch (docs/rules-adaptation.md, Potions). */
  | { kind: 'potion'; item: number; target: string }
  /** Use a readied scroll, wand, or staff's spell at a target or row (Scrolls; Devices). */
  | { kind: 'invoke'; item: number; spell: string; target?: string; row?: number }
  /** Spend the Main Action trying to throw off the Torment of Tumefaction. */
  | { kind: 'shake-off' }
  /** Spend the Main Action taking form again out of Wind Walking's mist. */
  | { kind: 'end-mist' }
  /** Change Form into a Skinshifter's form by index, or back to their own shape (1.5.15). */
  | { kind: 'shift'; form: number | null }
  /** Bind Companion on a beast among the foes, or Howl of Distant Summons (1.5.4). */
  | { kind: 'bind'; target: string }
  | { kind: 'howl' }
  | { kind: 'wait' };

export type Outcome = 'party' | 'enemy' | 'draw';

/**
 * One weapon blow, for the fight screen's floating numbers and flashes (docs/presentation-plan.md,
 * V3): a hit and its damage, a miss with or without Shock, or a blow turned aside by a shield, a
 * ward, or luck. Kept only when the battle keeps a log.
 */
export interface BattleEvent {
  kind: 'hit' | 'shock' | 'miss' | 'turned';
  actor: string;
  target: string;
  amount: number;
}

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
  /** Those who have held their turn this round (docs/rules-adaptation.md, Holding). */
  heldThisRound: Set<string>;
  /** The combatant whose turn has started and awaits a command, if any. */
  turnBegun: string | null;
  /** Monster rows (`side:group`) that have taken their first loss and rolled for it. */
  rowsChecked: Set<string>;
  /** Sides that have rolled Morale for losing half their number. */
  halfChecked: Set<SideId>;
  /**
   * Phase 19: the boss of a boss fight, by combatant id, whether its fall has been checked for, and
   * the sides with someone who can talk to animals, to whom beasts can surrender.
   */
  boss: string | null;
  bossFell: boolean;
  talksToBeasts: Record<SideId, boolean>;
  /** Each side's starting number of combatants. */
  startCount: Record<SideId, number>;
  stabilizedThisRound: Set<string>;
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
  log: string[] | null;
  /** For each log line, the side whose turn it came in; null between turns. Kept with the log. */
  logSides: (SideId | null)[] | null;
  /** The side whose turn is being played, or null between turns. */
  acting: SideId | null;
  events: BattleEvent[] | null;
  outcome: Outcome | null;
}

/** Chooses an action for a combatant on its turn. */
export type Controller = (battle: Battle, actor: Combatant) => Action;
