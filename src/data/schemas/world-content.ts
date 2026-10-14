import { z } from 'zod';
import { DungeonSchema } from './dungeon-content.ts';
import { RegionSchema } from './overland-content.ts';

/**
 * A world shipped with the game beside the campaign (Sam's call): one map played on its own, like
 * a map from the map editor, with the dungeons that stand on it. No campaign story comes with it.
 */
export const ShippedWorldSchema = z.strictObject({
  /** Shown when the world is picked. */
  description: z.string().min(1),
  map: RegionSchema,
  dungeons: z.array(DungeonSchema),
});
export type ShippedWorld = z.infer<typeof ShippedWorldSchema>;
