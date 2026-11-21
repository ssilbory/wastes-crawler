import { z } from 'zod';

/** Dungeon actions a key can be bound to (docs/plan.md, Phase 11: key remapping). */
export const KeyActionSchema = z.enum([
  'forward',
  'back',
  'turn-left',
  'turn-right',
  'step-left',
  'step-right',
  'search',
  'stairs',
]);
export type KeyAction = z.infer<typeof KeyActionSchema>;

export const TextSizeSchema = z.enum(['small', 'normal', 'large']);
export const CombatSpeedSchema = z.enum(['instant', 'fast', 'normal', 'slow']);
/** How the dungeon view and the fight's figures are drawn (docs/presentation-plan.md, V8). */
export const GraphicsSchema = z.enum(['pixel', 'vector']);
/** How hard a torch flickers in the dungeon view (docs/presentation-plan.md, V8); off holds it steady. */
export const FlickerSchema = z.enum(['off', 'low', 'normal', 'high']);

/** The player's settings, kept in the browser. */
export const SettingsSchema = z.strictObject({
  version: z.literal(1),
  /** Up to two keys per action, as KeyboardEvent.key values (letters lower-case). */
  keys: z.record(KeyActionSchema, z.array(z.string().min(1)).max(2)),
  sound: z.strictObject({ on: z.boolean(), volume: z.number().min(0).max(1) }),
  /** How fast auto-resolve plays out a fight. */
  combatSpeed: CombatSpeedSchema,
  textSize: TextSizeSchema,
  /** Settings stored before there was a choice take the pixel view. */
  graphics: GraphicsSchema.default('pixel'),
  /** Settings stored before there was a choice flicker as they always did. */
  flicker: FlickerSchema.default('normal'),
});
export type Settings = z.infer<typeof SettingsSchema>;
export type Flicker = z.infer<typeof FlickerSchema>;

/** Defaults and the speeds' delays, from data/content/settings-defaults.json. */
export const SettingsDefaultsSchema = z.strictObject({
  settings: SettingsSchema,
  /** Milliseconds between rounds at each combat speed. */
  roundDelays: z.record(CombatSpeedSchema, z.int().min(0)),
});
export type SettingsDefaults = z.infer<typeof SettingsDefaultsSchema>;

/** A synthesized sound cue: notes played one after another (no audio files). */
export const SoundCueSchema = z.strictObject({
  id: z.string().min(1),
  wave: z.enum(['sine', 'square', 'triangle', 'sawtooth']),
  notes: z.array(z.strictObject({ hz: z.number().positive(), ms: z.int().min(1) })).min(1),
});
export type SoundCue = z.infer<typeof SoundCueSchema>;
