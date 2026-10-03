import { z } from 'zod';
import { AttributeSchema, DiceSchema, IdSchema } from './common.ts';

/**
 * How an SRD monster fights in the engine: the SRD weapon behind a "Wpn" damage entry, and tags.
 * `flying` ignores formation and cover, `reach` attacks from the second row, `unliving` doesn't
 * sleep, and `metal` carries enough metal for Stunning Shock.
 */
export const MonsterCombatSchema = z.strictObject({
  id: IdSchema,
  weapon: IdSchema.optional(),
  tags: z.array(z.enum(['flying', 'reach', 'unliving', 'metal'])),
});
export type MonsterCombat = z.infer<typeof MonsterCombatSchema>;
export type MonsterTag = MonsterCombat['tags'][number];

const Save = z.enum(['physical', 'evasion', 'mental', 'luck']);

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
