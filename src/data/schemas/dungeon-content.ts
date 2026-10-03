import { z } from 'zod';
import { IdSchema } from './common.ts';

export const FacingSchema = z.enum(['n', 'e', 's', 'w']);
export type Facing = z.infer<typeof FacingSchema>;

/** A cell of a dungeon level: x across from the west, y down from the north, from 0. */
export const CellSchema = z.strictObject({ x: z.int().min(0), y: z.int().min(0) });
export type Cell = z.infer<typeof CellSchema>;

/** Where stairs lead: another level's cell and facing, or out to the hex map. */
export const StairsLinkSchema = z.strictObject({
  at: CellSchema,
  to: z.union([
    z.strictObject({ level: IdSchema, at: CellSchema, facing: FacingSchema }),
    z.strictObject({ surface: z.literal(true) }),
  ]),
});
export type StairsLink = z.infer<typeof StairsLinkSchema>;

/**
 * A dungeon level as the doubled ASCII grid from docs/plan.md (Map format): cells at odd rows and
 * columns, edges between them. See docs/content-guide.md for the glyphs.
 */
export const DungeonLevelSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  map: z.array(z.string()).min(3),
  links: z.array(StairsLinkSchema),
});
export type DungeonLevel = z.infer<typeof DungeonLevelSchema>;

/** A dungeon entered from a hex of an overland region. */
export const DungeonSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  region: IdSchema,
  entrance: z.strictObject({ col: z.int().min(0), row: z.int().min(0) }),
  /** Where the party stands on coming down from the surface. */
  entry: z.strictObject({ level: IdSchema, at: CellSchema, facing: FacingSchema }),
  levels: z.array(DungeonLevelSchema).min(1),
});
export type Dungeon = z.infer<typeof DungeonSchema>;
