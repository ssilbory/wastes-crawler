import { z } from 'zod';
import { DiceSchema } from './common.ts';

const Save = z.enum(['physical', 'evasion', 'mental', 'luck']);

/**
 * The combat effects of the Elementalist spells built in Phase 18b, each from its text in
 * vendor/wwn-srd/4.0 Magic and Spellcasting/4.5.0 Elementalist Spells.md, with one fixed element
 * each (docs/rules-adaptation.md, Elementalist spells in combat).
 */
export const ElementalistEffects = [
  /** Flame Without End on an ally's weapon: `bonus` damage on a hit, nothing to Shock. */
  z.strictObject({ kind: z.literal('flame-weapon'), bonus: z.int().min(1) }),
  /** Elemental Vallation, fire: each foe crossing to melee the caster's side takes `damage` + level. */
  z.strictObject({ kind: z.literal('wall'), damage: DiceSchema }),
  /** Like the Stones, stone: `ignore` points off each harm, stabilizing at zero, no poison. */
  z.strictObject({ kind: z.literal('stone-form'), ignore: z.int().min(1) }),
  /** Wind Walking: weapons can't touch the target and it can't attack, until it takes form again. */
  z.strictObject({ kind: z.literal('mist') }),
  /** Calcifying Scourge: a failed save turns the target to stone; a save slows it `slowed` rounds. */
  z.strictObject({ kind: z.literal('calcify'), save: Save, slowed: DiceSchema }),
  /** Fury of the Elements: `damage` to a row, wandering among the foe's rows for `rounds` rounds. */
  z.strictObject({ kind: z.literal('fury'), damage: DiceSchema, rounds: DiceSchema }),
] as const;
