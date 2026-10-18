import { z } from 'zod';
import { FormSchema, CharacterSchema } from './character.ts';
import { AttributeSchema } from './common.ts';

/** What a character does when the player hands the round to its default (Phase 4 arena). */
export const DEFAULT_PRESETS = ['auto', 'attack', 'defend', 'repeat'] as const;
export const DefaultPresetSchema = z.enum(DEFAULT_PRESETS);
export type DefaultPreset = z.infer<typeof DefaultPresetSchema>;

export const ROSTER_SCHEMA_VERSION = 1;

const Scores = z.record(AttributeSchema, z.int().min(3).max(18));
const Adjustments = z.partialRecord(AttributeSchema, z.int());

/** The character builder's picks, kept so a saved character can be opened in it again. */
export const ChoicesSchema = z.strictObject({
  people: z.string(),
  lineage: z.string().nullable(),
  array: Scores.nullable(),
  attributeMethod: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('array') }),
    z.strictObject({
      kind: z.literal('roll'),
      rolled: Scores,
      swap: AttributeSchema.nullable(),
      rerolls: z.int().min(0),
    }),
    z.strictObject({ kind: z.literal('manual'), rerolls: z.int().min(0) }),
  ]),
  background: z
    .strictObject({
      id: z.string(),
      choice: z.discriminatedUnion('mode', [
        z.strictObject({
          mode: z.literal('pick'),
          picks: z.array(z.strictObject({ index: z.int(), skill: z.string().exactOptional() })),
        }),
        z.strictObject({
          mode: z.literal('roll'),
          rolls: z.array(
            z.strictObject({
              table: z.enum(['growth', 'learning']),
              index: z.int(),
              skill: z.string().exactOptional(),
              allocation: Adjustments.exactOptional(),
            }),
          ),
        }),
      ]),
    })
    .nullable(),
  classId: z.string().nullable(),
  classSkills: z.array(z.string().nullable()),
  foci: z.array(
    z
      .strictObject({
        id: z.string(),
        skill: z.string().exactOptional(),
        attribute: AttributeSchema.optional(),
      })
      .nullable(),
  ),
  magic: z
    .strictObject({
      arts: z.array(z.string()),
      known: z.array(z.string()),
      prepared: z.array(z.string()),
    })
    .nullable(),
  forms: z.array(FormSchema).exactOptional(),
  freeSkill: z.string().nullable(),
  gear: z
    .discriminatedUnion('mode', [
      z.strictObject({ mode: z.literal('package'), packageId: z.string().nullable() }),
      z.strictObject({
        mode: z.literal('shop'),
        crowns: z.number().nullable(),
        items: z.array(CharacterSchema.shape.inventory.element),
      }),
    ])
    .nullable(),
  name: z.string(),
  goal: z.string(),
});

/**
 * Saved characters in browser storage. Each character keeps its own schemaVersion and goes through
 * the character importer's migrations, so the roster only checks its own shape here. `choices` are
 * the builder's picks for characters made in it, checked when the character is opened again.
 */
export const RosterSchema = z.strictObject({
  version: z.literal(ROSTER_SCHEMA_VERSION),
  entries: z.array(
    z.strictObject({
      id: z.string().min(1),
      defaultAction: DefaultPresetSchema,
      character: z.unknown(),
      choices: z.unknown().optional(),
    }),
  ),
});
