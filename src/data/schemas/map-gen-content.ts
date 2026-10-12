import { z } from 'zod';
import { DungeonSchema } from './dungeon-content.ts';
import { IdSchema } from './common.ts';
import { RegionSchema } from './overland-content.ts';
import { TownSizeSchema } from './town-content.ts';

const Unit = z.number().min(0).max(1);

/**
 * How the overland map editor rolls a random region (Sam's call: an authoring tool, not a rule).
 * Each hex gets a height and a wetness from 0 to 1; the first biome whose ranges hold both gives
 * its terrain, and the last biome takes whatever none of the others do.
 */
export const MapGenSchema = z.strictObject({
  biomes: z
    .array(
      z.strictObject({
        terrain: IdSchema,
        height: z.tuple([Unit, Unit]),
        wet: z.tuple([Unit, Unit]),
        /** Dangerous wilderness, unless a settlement is near. */
        dangerous: z.boolean(),
      }),
    )
    .min(1),
  /** Relative odds of each settlement size; the largest rolled is where a new party starts. */
  sizes: z.record(TownSizeSchema, z.int().min(0)),
  /** Hexes between settlements, where the land allows. */
  spacing: z.int().min(1),
  /** Within this many hexes of a settlement the land is never dangerous. */
  safeRadius: z.int().min(0),
  /** Settlement names join one of each. */
  names: z.strictObject({
    first: z.array(z.string().min(1)).min(1),
    second: z.array(z.string().min(1)).min(1),
  }),
  /** What the editor offers for a new map. */
  defaults: z.strictObject({
    width: z.int().min(4).max(60),
    height: z.int().min(4).max(60),
    settlements: z.int().min(1).max(30),
  }),
});
export type MapGen = z.infer<typeof MapGenSchema>;

/**
 * The editors' saved work in browser storage: dungeons and overland maps, each checked on its own
 * so one that no longer loads doesn't cost the rest.
 */
export const EditorLibraryFileSchema = z.strictObject({
  version: z.literal(1),
  dungeons: z.array(z.unknown()),
  regions: z.array(z.unknown()),
});

export const EditorLibrarySchema = z.strictObject({
  dungeons: z.array(DungeonSchema),
  regions: z.array(RegionSchema),
});
export type EditorLibrary = z.infer<typeof EditorLibrarySchema>;
