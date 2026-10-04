import { z } from 'zod';
import { AttributeSchema, DiceSchema, IdSchema } from './common.ts';
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
 * sleep, `metal` carries enough metal for Stunning Shock, and `slow` always acts last. `loot` is
 * what each one drops when the party wins; none for beasts and the mindless. `caster` makes it
 * cast.
 */
export const MonsterCombatSchema = z.strictObject({
  id: IdSchema,
  weapon: IdSchema.optional(),
  tags: z.array(z.enum(['flying', 'reach', 'unliving', 'metal', 'slow'])),
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
  /** +AC while the Effort stays committed, never above `maxAc`. */
  z.strictObject({ kind: z.literal('ac-bonus'), amount: z.int().min(1), maxAc: z.int() }),
  /** The target loses its next Main Action, or only its Move action on a save. */
  z.strictObject({ kind: z.literal('stun'), save: Save, requiresTag: z.literal('metal') }),
  /** Reroll a spell's damage and keep the better (Empowered Sorcery). */
  z.strictObject({ kind: z.literal('reroll-damage') }),
  /** Make an enemy reroll a successful save and keep the worse (Inexorable Effect). */
  z.strictObject({ kind: z.literal('force-save-reroll') }),
]);
export type CombatEffect = z.infer<typeof CombatEffectSchema>;

export const CombatMagicSchema = z.strictObject({
  id: IdSchema,
  source: z.enum(['spell', 'art']),
  target: z.enum(['enemy', 'enemy-row', 'ally', 'ally-not-self', 'self', 'none']),
  /** Arts commit Effort for the scene, the day, or as long as the effect lasts. */
  effort: z.enum(['scene', 'day', 'committed']).optional(),
  /** Usable once per scene, or once per target per scene. */
  limit: z.enum(['scene', 'target-scene']).optional(),
  effect: CombatEffectSchema,
});
export type CombatMagic = z.infer<typeof CombatMagicSchema>;
