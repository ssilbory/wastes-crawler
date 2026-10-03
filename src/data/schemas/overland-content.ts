import { z } from 'zod';
import { DiceSchema, IdSchema } from './common.ts';
import { TownSizeSchema } from './town-content.ts';

/**
 * A terrain type (docs/rules-adaptation.md, Overland travel). `survive` is the SRD 2.12.5 forage
 * difficulty, also used to Lead the Way and Make Camp; `hunt` is the Hunt difficulty, or null where
 * there's no game. Water allows fishing.
 */
export const TerrainSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** One character in the map's terrain rows. */
  glyph: z.string().length(1),
  movement: z.enum(['open', 'difficult', 'impassable']),
  survive: z.int().min(2),
  hunt: z.int().min(2).nullable(),
  water: z.boolean(),
  /** Nights here are harsh, so sleeping without a camp makes a character Cold. */
  harsh: z.boolean(),
  encounters: IdSchema,
});
export type Terrain = z.infer<typeof TerrainSchema>;

export const DangerSchema = z.enum(['road', 'ordinary', 'dangerous']);
export type Danger = z.infer<typeof DangerSchema>;

/** Overlay glyphs: `=` a road, `.` ordinary land, `!` dangerous wilderness. */
export const DANGER_GLYPHS: Record<string, Danger> = {
  '=': 'road',
  '.': 'ordinary',
  '!': 'dangerous',
};

export const SiteSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  kind: z.literal('town'),
  /** Sets the town's spending and loot thresholds. */
  size: TownSizeSchema,
  col: z.int().min(0),
  row: z.int().min(0),
});
export type Site = z.infer<typeof SiteSchema>;

/** An overland region as glyph rows in odd-q offset layout (src/rules/hex.ts). */
export const RegionSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  terrain: z.array(z.string().min(1)).min(1),
  overlay: z.array(z.string().min(1)).min(1),
  sites: z.array(SiteSchema).min(1),
  /** The town a new party starts in. */
  start: IdSchema,
});
export type Region = z.infer<typeof RegionSchema>;

export const EncounterGroupSchema = z.strictObject({
  monster: IdSchema,
  /** A fixed number, or dice. */
  count: z.union([z.int().min(1), DiceSchema]),
  /** The enemy row they stand in, front first. */
  row: z.int().min(0).max(2),
});

/**
 * Wandering encounters by terrain. Hostile groups fight unless the reaction roll is friendly or
 * better; wary ones only on an unfriendly roll or worse (SRD 5.2.1).
 */
export const EncounterTableSchema = z.strictObject({
  id: IdSchema,
  entries: z
    .array(
      z.strictObject({
        weight: z.int().min(1),
        nature: z.enum(['hostile', 'wary']),
        groups: z.array(EncounterGroupSchema).min(1),
      }),
    )
    .min(1),
});
export type EncounterTable = z.infer<typeof EncounterTableSchema>;

const Who = z.enum(['one', 'all']);

export const MishapEffectSchema = z.discriminatedUnion('kind', [
  /** The march stops in the hex just entered. */
  z.strictObject({ kind: z.literal('end-march') }),
  z.strictObject({ kind: z.literal('damage'), dice: DiceSchema, who: Who }),
  z.strictObject({ kind: z.literal('strain'), amount: z.int().min(1), who: Who }),
  z.strictObject({ kind: z.literal('rations'), steps: z.int().max(-1) }),
  /** Like a night without shelter: no recovery tonight (SRD 2.12.4). */
  z.strictObject({ kind: z.literal('no-recovery') }),
  /** An extra wandering encounter check. */
  z.strictObject({ kind: z.literal('encounter') }),
]);
export type MishapEffect = z.infer<typeof MishapEffectSchema>;

/** Travel and camp mishaps (docs/rules-adaptation.md, Lead the Way and Make Camp); our text. */
export const MishapSchema = z.strictObject({
  id: IdSchema,
  table: z.enum(['travel', 'camp']),
  weight: z.int().min(1),
  text: z.string().min(1),
  effect: MishapEffectSchema,
});
export type Mishap = z.infer<typeof MishapSchema>;

export const SeasonSchema = z.enum(['spring', 'summer', 'autumn', 'winter']);

export const OverlandRulesSchema = z.strictObject({
  /** Wandering encounter die per quarter day, by danger (1 in N). */
  encounterDice: z.strictObject({
    road: z.int().min(2),
    ordinary: z.int().min(2),
    dangerous: z.int().min(2),
  }),
  /** Rations die steps for a successful Forage and Hunt. */
  forageSteps: z.int().min(1),
  huntSteps: z.int().min(1),
  months: z.array(z.strictObject({ name: z.string().min(1), season: SeasonSchema })).length(12),
  daysPerMonth: z.int().min(1),
  /** The calendar date a new world starts on, 0-based month. */
  start: z.strictObject({ month: z.int().min(0).max(11), day: z.int().min(1) }),
});
export type OverlandRules = z.infer<typeof OverlandRulesSchema>;
