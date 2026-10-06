import { z } from 'zod';
import { AttributeSchema, DiceSchema, IdSchema } from './common.ts';
import { ElementalistEffects } from './elementalist-content.ts';
import { HighMagicEffects } from './high-magic-content.ts';
import { NecromancerEffects } from './necromancer-content.ts';
import { LootDiceSchema } from './town-content.ts';

/**
 * A monster that casts (vendor/wwn-srd/5.0 Monsters and Foes/Monster and NPC Stats.md: the spells
 * and arts of a mage tradition at a level equal to its hit dice, Effort of its skill plus two): the
 * tradition, the SRD casting table its spell slots come from, and the spells it has prepared and
 * the arts it knows, all from data/content/combat-magic.json.
 */
export const MonsterCasterSchema = z.strictObject({
  tradition: IdSchema,
  slots: IdSchema,
  spells: z.array(IdSchema),
  arts: z.array(IdSchema),
});
export type MonsterCaster = z.infer<typeof MonsterCasterSchema>;

const SaveKind = z.enum(['physical', 'evasion', 'mental', 'luck']);

/**
 * What a hit does beyond its damage (Phase 14a). Poison: a Physical save at a penalty, or the
 * victim loses half its maximum hit points (vendor/wwn-srd/2.0 The Rules of the Game/2.10.0
 * Falling and Other Hazards.md, Poisons). Paralysis: a Physical save, or the victim is held,
 * unable to act, for the rolled number of rounds.
 */
export const OnHitSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('poison'), penalty: z.int().min(0) }),
  z.strictObject({ kind: z.literal('paralysis'), rounds: DiceSchema }),
]);
export type OnHit = z.infer<typeof OnHitSchema>;

/** One natural attack in a creature's routine, made `count` times. */
export const StrikeSchema = z.strictObject({
  name: z.string().min(1),
  damage: DiceSchema,
  count: z.int().min(1).max(4),
  onHit: OnHitSchema.optional(),
});
export type Strike = z.infer<typeof StrikeSchema>;

/**
 * How an SRD monster fights in the engine: the SRD weapon behind a "Wpn" damage entry, and tags.
 * `flying` ignores formation and cover, `reach` attacks from the second row, `unliving` doesn't
 * sleep, `metal` carries enough metal for Stunning Shock, `slow` always acts last, `undead`
 * answers to necromancy (Phase 14b), `large` is bigger than a man (the Sigil of Aeolian
 * Auctoritas can't move it), and `plant` withers under Decree of Ligneous Dissolution. `loot` is
 * what each one drops when the party wins; none for beasts and the mindless. `caster` makes it
 * cast.
 */
export const MonsterCombatSchema = z.strictObject({
  id: IdSchema,
  weapon: IdSchema.optional(),
  tags: z.array(
    z.enum(['flying', 'reach', 'unliving', 'metal', 'slow', 'undead', 'large', 'plant']),
  ),
  /** Its blows only knock foes out, as the Phantasmal Eidolon's (4.4.0). */
  nonLethal: z.literal(true).optional(),
  loot: LootDiceSchema.optional(),
  /** Who can be parleyed with: people always, animals and monsters with foci, the mindless never. */
  mind: z.enum(['sapient', 'animal', 'monster', 'mindless']),
  caster: MonsterCasterSchema.optional(),
  /**
   * Mixed natural attacks made together as the Main Action (claws and a bite), replacing the stat
   * line's single damage; the counts add up to its attacks (Phase 14a).
   */
  routine: z.array(StrikeSchema).min(1).optional(),
  /** Ranged strikes made instead when the routine can reach no one (a manticore's spikes). */
  volley: z.array(StrikeSchema).min(1).optional(),
  /** A Main Action against one enemy row: one damage roll, a save for half, so many a fight. */
  breath: z
    .strictObject({
      name: z.string().min(1),
      damage: DiceSchema,
      save: SaveKind,
      uses: z.int().min(1),
    })
    .optional(),
  /** Half damage from blunt or edged weapons, and only 1 from missiles. */
  resist: z
    .strictObject({
      blunt: z.literal('half').optional(),
      edged: z.literal('half').optional(),
      missiles: z.literal('one').optional(),
    })
    .optional(),
});
export type Mind = MonsterCombat['mind'];
export type MonsterCombat = z.infer<typeof MonsterCombatSchema>;
export type MonsterTag = MonsterCombat['tags'][number];

const Save = SaveKind;

/** The combat mechanics of a spell or art, taken from its SRD text. */
export const CombatEffectSchema = z.discriminatedUnion('kind', [
  /** Damage dice per caster level, with a save for half; NPCs at or under `slayHitDice` die. */
  z.strictObject({
    kind: z.literal('damage'),
    perLevel: DiceSchema,
    save: Save,
    slayHitDice: z.int().min(0),
  }),
  /** Every living creature in one enemy row with this many hit dice or fewer falls asleep. */
  z.strictObject({ kind: z.literal('sleep'), maxHitDice: z.int().min(1) }),
  /** Blinded for the scene on a failed save, or for one round on a success. */
  z.strictObject({ kind: z.literal('blind'), save: Save }),
  /** Weapon hits on the ward need a successful Physical save by the attacker. */
  z.strictObject({ kind: z.literal('ward') }),
  /** A failed save, at a penalty of the caster's skill, takes the target out of the fight. */
  z.strictObject({ kind: z.literal('enthrall'), save: Save, penaltySkill: IdSchema }),
  /** An attack roll with the skill, the best attribute, and the caster level to hit and damage. */
  z.strictObject({
    kind: z.literal('blast'),
    skill: IdSchema,
    attributes: z.array(AttributeSchema).min(1),
    damage: DiceSchema,
  }),
  /**
   * +AC never above `maxAc`: Pavis of Elements while the Effort stays committed, Ward of the Turning
   * Wind on an ally for the fight. The two don't combine.
   */
  z.strictObject({ kind: z.literal('ac-bonus'), amount: z.int().min(1), maxAc: z.int() }),
  /** The target loses its next Main Action, or only its Move action on a save. */
  z.strictObject({ kind: z.literal('stun'), save: Save, requiresTag: z.literal('metal') }),
  /**
   * Smite the Dead (4.6.0): damage dice per caster level to every hostile creature with the tag in
   * one row; those with hit dice no more than the caster level fail a save or are destroyed.
   */
  z.strictObject({
    kind: z.literal('smite'),
    perLevel: DiceSchema,
    save: Save,
    requiresTag: z.literal('undead'),
  }),
  /** Armor of God (1.5.5.1): a natural AC of `base` plus half the level, rounded down. */
  z.strictObject({ kind: z.literal('ac-floor'), base: z.int().min(10) }),
  /**
   * Merciful Healing: the dice of the highest tier reached, adding `strain` System Strain in
   * combat; it revives the Mortally Wounded.
   */
  z.strictObject({
    kind: z.literal('heal'),
    tiers: z.array(z.strictObject({ level: z.int().min(1), dice: DiceSchema })).min(1),
    strain: z.int().min(0),
  }),
  /** God Wills It: the caster's side gains the tier's bonus to hit, damage, and Shock. */
  z.strictObject({
    kind: z.literal('bless'),
    tiers: z.array(z.strictObject({ level: z.int().min(1), bonus: z.int().min(1) })).min(1),
  }),
  /**
   * Smite the Wicked: an attack with `hit` more to hit, the level in automatic damage, and the
   * damage dice rolled twice, the better kept.
   */
  z.strictObject({ kind: z.literal('smite-wicked'), hit: z.int().min(1) }),
  /**
   * Turn False Life: `dice` plus the level in hit dice of foes with the tags, none with more than
   * twice the level, weakest first; each fails a save or cowers, out of the fight.
   */
  z.strictObject({
    kind: z.literal('turn'),
    dice: DiceSchema,
    save: Save,
    tags: z.array(z.enum(['undead', 'unliving'])).min(1),
  }),
  /** Wrath of the Most High: the target's next damage by the end of next round adds `dice` + level. */
  z.strictObject({ kind: z.literal('wrath'), dice: DiceSchema }),
  /**
   * Healing Touch (1.5.9.1): `dice` plus the caster's skill, adding `strain` System Strain to the
   * target each time; it revives the Mortally Wounded. Empowered Healer adds the level.
   */
  z.strictObject({
    kind: z.literal('touch-heal'),
    dice: DiceSchema,
    skill: IdSchema,
    strain: z.int().min(0),
  }),
  /** Final Repose: the target takes the caster's skill as a Physical save penalty for the scene. */
  z.strictObject({ kind: z.literal('repose'), skill: IdSchema }),
  /** Sight that ignores darkness: the user's, or with `party` the whole side's (Phase 15). */
  z.strictObject({ kind: z.literal('dark-sight'), party: z.boolean() }),
  /** Steps of Air: the target flies for a round per caster level; Boreal Wings, for the scene. */
  z.strictObject({ kind: z.literal('flight'), scene: z.literal(true).optional() }),
  /** Petrifying Stare: a failed save lands a flyer and roots it for half the caster level. */
  z.strictObject({ kind: z.literal('petrify'), save: Save }),
  /** Sanctified Ward: +4 AC and saves, no Shock, and foes look elsewhere, until a hostile act. */
  z.strictObject({ kind: z.literal('sanctify') }),
  /** Reroll a spell's damage and keep the better (Empowered Sorcery). */
  z.strictObject({ kind: z.literal('reroll-damage') }),
  /** Make an enemy reroll a successful save and keep the worse (Inexorable Effect). */
  z.strictObject({ kind: z.literal('force-save-reroll') }),
  ...HighMagicEffects,
  ...ElementalistEffects,
  ...NecromancerEffects,
]);
export type CombatEffect = z.infer<typeof CombatEffectSchema>;

export const CombatMagicSchema = z.strictObject({
  id: IdSchema,
  source: z.enum(['spell', 'art']),
  /** `allies` and `enemies` are whole sides; `wounded-ally` takes the Mortally Wounded too. */
  target: z.enum([
    'enemy',
    'enemy-row',
    'enemies',
    'ally',
    'ally-not-self',
    'wounded-ally',
    'allies',
    'self',
    'none',
    'any',
    'place',
  ]),
  /**
   * Arts commit Effort for the scene, the day, or as long as the effect lasts; `activate` commits
   * it for the scene on the first use only, later uses that scene being free (Healing Touch).
   */
  effort: z.enum(['scene', 'day', 'committed', 'activate']).optional(),
  /** Usable once per scene, or once per target per scene. */
  limit: z.enum(['scene', 'target-scene']).optional(),
  effect: CombatEffectSchema,
});
export type CombatMagic = z.infer<typeof CombatMagicSchema>;
