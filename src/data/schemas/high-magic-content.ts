import { z } from 'zod';
import { DiceSchema, IdSchema } from './common.ts';

const Save = z.enum(['physical', 'evasion', 'mental', 'luck']);

/**
 * The combat effects of the High Magic spells built in Phase 18a, each from its text in
 * vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0 High Magic Spells by Level.md
 * (docs/rules-adaptation.md, High Magic in combat).
 */
export const HighMagicEffects = [
  /**
   * One damage roll on a row: `perLevel` dice for each `levelsPerDie` caster levels, a save for
   * half. Only creatures with `requiresTag` are hurt; those of `slayHitDice` or fewer die; a failed
   * save roots them for `rootOnFail` rounds; `outdoorsOnly` can't be cast underground, and with
   * `backlash` the caster saves or takes a quarter of the damage.
   */
  z.strictObject({
    kind: z.literal('burst'),
    perLevel: DiceSchema,
    levelsPerDie: z.int().min(1),
    save: Save,
    slayHitDice: z.int().min(0),
    requiresTag: z.literal('plant').optional(),
    rootOnFail: DiceSchema.optional(),
    outdoorsOnly: z.literal(true).optional(),
    backlash: Save.optional(),
  }),
  /** Conjunction of the Inexorable Step: a failed save sends the target away, a success the caster. */
  z.strictObject({ kind: z.literal('step'), save: Save }),
  /** Mantle of Disjecting Dissection: melee attackers save or take `damage` plus the level first. */
  z.strictObject({ kind: z.literal('mantle'), save: Save, damage: DiceSchema }),
  /** Resounding Temporal Echo: up to a level's allies take an extra attack for `rounds` rounds. */
  z.strictObject({ kind: z.literal('echo'), rounds: DiceSchema, strain: z.int().min(0) }),
  /** Extirpate Arcana: the magic on every creature in the target's row on its side ends. */
  z.strictObject({ kind: z.literal('dispel') }),
  /** Prudentially Transient Abnegation of Life: cast when an ally falls (reactions.ts). */
  z.strictObject({
    kind: z.literal('abnegation'),
    hpPerLevel: z.int().min(1),
    strain: z.int().min(0),
  }),
  /** Phobic Storm: each enemy checks Morale at `penalty`; those who hold take a point a level. */
  z.strictObject({ kind: z.literal('fear'), penalty: z.int().min(0) }),
  /** Scorn the Fetters of Earth: allies fly for the scene, or flying foes save or are grounded. */
  z.strictObject({ kind: z.literal('skyward'), save: Save, penaltySkill: IdSchema }),
  /** The Torment of Tumefaction: `perLevel` per caster level each round the target attacks. */
  z.strictObject({ kind: z.literal('torment'), perLevel: z.int().min(1), save: Save }),
  /** The Glass Chimes shattered: `damage` to everyone but the caster. */
  z.strictObject({ kind: z.literal('shatter'), damage: DiceSchema }),
  /** Evert the Inwardness: no more hit dice than the level saves or dies; all take damage, save half. */
  z.strictObject({ kind: z.literal('evert'), perLevel: DiceSchema, save: Save }),
  /** The Sigil's gust: all but large creatures in the row save or lose their next action and take `damage`. */
  z.strictObject({ kind: z.literal('gust'), save: Save, damage: DiceSchema }),
  /** Calculation of the Phantasmal Eidolon: the monster, with `hp`, fights beside the caster until dawn. */
  z.strictObject({ kind: z.literal('summon'), monster: IdSchema, hp: z.int().min(1) }),
  /** Banishment: the row saves to return next round; `trappedHitDice` or fewer can't save. */
  z.strictObject({ kind: z.literal('banish'), save: Save, trappedHitDice: z.int().min(0) }),
  /** The Dazzling Prismatic Hemicycle: every foe saves or rolls a d6 for its fate. */
  z.strictObject({ kind: z.literal('prismatic'), save: Save }),
] as const;
