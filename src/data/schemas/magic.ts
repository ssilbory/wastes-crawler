import { z } from 'zod';
import { recordBase } from './common.ts';

export const SpellSchema = z.strictObject({
  ...recordBase,
  tradition: z.enum(['high-magic', 'elementalist']),
  level: z.int().min(1).max(5),
  text: z.string().min(1),
});
export type Spell = z.infer<typeof SpellSchema>;

export const ArtSchema = z.strictObject({
  ...recordBase,
  tradition: z.enum(['high-mage', 'elementalist']),
  /** Arts every member of the tradition gains at first level. */
  automatic: z.boolean(),
  text: z.string().min(1),
});
export type Art = z.infer<typeof ArtSchema>;
