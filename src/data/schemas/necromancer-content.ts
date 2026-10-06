import { z } from 'zod';
import { IdSchema } from './common.ts';

const Save = z.enum(['physical', 'evasion', 'mental', 'luck']);

/**
 * The combat effects of the Necromancer spells built in Phase 18c, each from its text in
 * vendor/wwn-srd/4.0 Magic and Spellcasting/4.6.0 Necromancer Spells.md (docs/rules-adaptation.md,
 * Necromancer spells in combat).
 */
export const NecromancerEffects = [
  /** Augment Mortal Vitality: the caster's `skill` on Physical saves, stabilizing, one healed wound. */
  z.strictObject({ kind: z.literal('vitality'), skill: IdSchema, strain: z.int().min(0) }),
  /** Enfeebling Wave: living foes in a row save or attack at a disadvantage and roll damage twice. */
  z.strictObject({ kind: z.literal('enfeeble'), save: Save }),
  /** Compel Flesh: the foe is held and turned on its own side until a save throws it off. */
  z.strictObject({ kind: z.literal('compel'), save: Save }),
  /** Forgetting the Grave: an ally can't die for a round per level. */
  z.strictObject({ kind: z.literal('deathless') }),
  /** Merge Souls: the caster and an ally pool their hit points for the fight. */
  z.strictObject({ kind: z.literal('merge') }),
  /** Call of the Tomb: foes save or are struck by every blow, for full damage, for a round a level. */
  z.strictObject({ kind: z.literal('tomb'), save: Save }),
  /** Everlasting: cast for the player as an ally would fall; no ally drops below 1 HP for `rounds`. */
  z.strictObject({ kind: z.literal('everlasting'), rounds: z.int().min(1) }),
  /** Final Death: foes in a row, one a level, can't heal or come back, and die at zero hit points. */
  z.strictObject({ kind: z.literal('final-death') }),
] as const;
