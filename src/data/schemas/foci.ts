import { z } from 'zod';
import { recordBase } from './common.ts';

export const FocusSchema = z.strictObject({
  ...recordBase,
  /** Flavor text plus any usage requirement, verbatim. */
  description: z.string().min(1),
  /** Empty for the GM-defined foci (Special Origin, Unique Gift). */
  levels: z.array(z.strictObject({ level: z.int().min(1).max(2), text: z.string().min(1) })).max(2),
});
export type Focus = z.infer<typeof FocusSchema>;
