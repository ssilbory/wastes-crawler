import { z } from 'zod';

/** What a character does when the player hands the round to its default (Phase 4 arena). */
export const DEFAULT_PRESETS = ['auto', 'attack', 'defend', 'repeat'] as const;
export const DefaultPresetSchema = z.enum(DEFAULT_PRESETS);
export type DefaultPreset = z.infer<typeof DefaultPresetSchema>;

export const ROSTER_SCHEMA_VERSION = 1;

/**
 * Saved characters in browser storage. Each character keeps its own schemaVersion and goes through
 * the character importer's migrations, so the roster only checks its own shape here.
 */
export const RosterSchema = z.strictObject({
  version: z.literal(ROSTER_SCHEMA_VERSION),
  entries: z.array(
    z.strictObject({
      id: z.string().min(1),
      defaultAction: DefaultPresetSchema,
      character: z.unknown(),
    }),
  ),
});
