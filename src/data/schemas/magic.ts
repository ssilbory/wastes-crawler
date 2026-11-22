import { z } from 'zod';
import { recordBase } from './common.ts';

/** The three spell lists (vendor/wwn-srd/4.0 Magic and Spellcasting/4.4.0, 4.5.0, 4.6.0). */
export const SpellTraditionSchema = z.enum(['high-magic', 'elementalist', 'necromancer']);
export type SpellTradition = z.infer<typeof SpellTraditionSchema>;

export const SpellSchema = z.strictObject({
  ...recordBase,
  tradition: SpellTraditionSchema,
  level: z.int().min(1).max(5),
  text: z.string().min(1),
});
export type Spell = z.infer<typeof SpellSchema>;

export const ArtSchema = z.strictObject({
  ...recordBase,
  tradition: z.enum([
    'high-mage',
    'elementalist',
    'necromancer',
    'blood-priest',
    'healer',
    'skinshifter',
    'beastmaster',
    'vowed',
  ]),
  /** Arts every member of the tradition gains at first level. */
  automatic: z.boolean(),
  text: z.string().min(1),
});
export type Art = z.infer<typeof ArtSchema>;
