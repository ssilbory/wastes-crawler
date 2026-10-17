import { z } from 'zod';
import { IdSchema } from './common.ts';

/**
 * The Wastes' warlord ladder (docs/rules-adaptation.md, The Wastes: Warlords): one warlord a map,
 * fallen when the hoard naming them in their stronghold is won.
 */
export const WarlordSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** The map they rule. */
  region: IdSchema,
  /** The map's tables their warband rides and their fall thins: open, rough, and oasis land. */
  tables: z.array(IdSchema).min(1),
  /** The journal's line when they fall. */
  fall: z.string().min(1),
});
export type Warlord = z.infer<typeof WarlordSchema>;

export const WarlordContentSchema = z.strictObject({
  /** What weight a fallen warlord's map's other hostile entries keep, rounded up. */
  hostilePercent: z.int().min(1).max(100),
  /** How much more that map's villages pay for gear and loot. */
  spoilsPercent: z.int().min(0).max(100),
  warlords: z.array(WarlordSchema),
});
export type WarlordContent = z.infer<typeof WarlordContentSchema>;
