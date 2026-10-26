import { z } from 'zod';
import { ExposureSchema } from './ailment-content.ts';
import { AttributeSchema, DiceSchema, ElementSchema, IdSchema } from './common.ts';
import { LootDiceSchema } from './town-content.ts';

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

/** Where a secret door is and how hard it is to find; doors not listed take difficulty 8. */
export const SecretSchema = z.strictObject({
  at: CellSchema,
  side: FacingSchema,
  difficulty: z.int().min(1),
});
export type Secret = z.infer<typeof SecretSchema>;

/**
 * A trap on a `T` cell (docs/rules-adaptation.md, Dungeon exploration): a Wis/Notice difficulty to
 * spot it, a skill check to disarm it, the save each PC makes when it springs (null for none), and
 * what it does to those who fail.
 */
export const TrapSchema = z.strictObject({
  at: CellSchema,
  name: z.string().min(1),
  notice: z.int().min(1),
  disarm: z.strictObject({
    skill: IdSchema,
    attributes: z.array(AttributeSchema).min(1),
    difficulty: z.int().min(1),
  }),
  save: z.enum(['physical', 'evasion', 'mental', 'luck']).nullable(),
  /** The substance that does the harm, which Pact of Stone and Sea can ward off. */
  element: ElementSchema.optional(),
  effect: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('damage'), dice: DiceSchema }),
    /** SRD 2.10.0: dungeon poison takes half the victim's maximum hit points, and lingers. */
    z.strictObject({ kind: z.literal('poison') }),
    /** SRD 2.5.5: filth that passes on a disease (Sam's call). */
    z.strictObject({ kind: z.literal('disease'), disease: IdSchema }),
    /** Brings the level's wanderers at once. */
    z.strictObject({ kind: z.literal('alarm') }),
  ]),
});
export type Trap = z.infer<typeof TrapSchema>;

/** A kind of trap the ruin generators set (docs/rules-adaptation.md, Ruins): a trap with no cell yet. */
export const RuinTrapSchema = TrapSchema.omit({ at: true });
export type RuinTrap = z.infer<typeof RuinTrapSchema>;

/** A captive held on an `N` cell by a fixed group of guards (Phase 8c). */
export const HeldCaptiveSchema = z.strictObject({
  at: CellSchema,
  captive: IdSchema,
  guards: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3),
  text: z.string().min(1),
});
export type HeldCaptive = z.infer<typeof HeldCaptiveSchema>;

/** A bound garrison post on a cell, met on stepping onto it until its order ends (Phase 12c). */
export const GarrisonPostSchema = z.strictObject({
  at: CellSchema,
  order: IdSchema,
  enemies: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3),
  text: z.string().min(1),
});
export type GarrisonPost = z.infer<typeof GarrisonPostSchema>;

const At = { at: CellSchema };
/** A special square: no glyph, found by walking onto it. */
export const SpecialSchema = z.discriminatedUnion('kind', [
  /**
   * Text shown the first time the party steps here. With `people`, only when a living PC is one of
   * them; `{pc}` in the text names the first such PC (Phase 12c).
   */
  z.strictObject({
    kind: z.literal('message'),
    ...At,
    text: z.string().min(1),
    people: z.array(IdSchema).min(1).optional(),
  }),
  z.strictObject({
    kind: z.literal('teleporter'),
    ...At,
    to: z.strictObject({ level: IdSchema, at: CellSchema, facing: FacingSchema }),
  }),
  /** Turns the party to a random facing without a word. */
  z.strictObject({ kind: z.literal('spinner'), ...At }),
  /** The automap records nothing here. */
  z.strictObject({ kind: z.literal('anti-map'), ...At }),
  /** As dark as having no light. */
  z.strictObject({ kind: z.literal('darkness'), ...At }),
  /** No spells or arts in a fight here. */
  z.strictObject({ kind: z.literal('anti-magic'), ...At }),
  /**
   * A loot cache, taken the first time the party steps here (Phase 12e); a vault's guards must be
   * beaten first.
   */
  z.strictObject({
    kind: z.literal('cache'),
    ...At,
    loot: z.array(LootDiceSchema).min(1),
    component: IdSchema.optional(),
    guards: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3).optional(),
    /** What the party sees as a hoard's guards rise: the level's boss (Sam's call). */
    text: z.string().min(1).optional(),
    /** The standing order its guards keep: they challenge first, its countersign stands them down
     * and gives up the hoard, and beating them ends it (Sam's call: the Warden). */
    order: IdSchema.optional(),
    vault: z.literal(true).optional(),
    /** The Wastes warlord who is this hoard's boss: winning it is their fall. */
    warlord: IdSchema.optional(),
  }),
  /** A set of crafter's notes, found the first time the party steps here (Phase 12d). */
  z.strictObject({ kind: z.literal('notes'), ...At, set: IdSchema, text: z.string().min(1) }),
  /** A token of command authority, taken the first time the party steps here (Phase 12d). */
  z.strictObject({
    kind: z.literal('token'),
    ...At,
    authority: IdSchema,
    text: z.string().min(1),
  }),
  /**
   * A clue that teaches a standing order's countersign the first time the party steps here; or,
   * with `pieces`, one of that many clues, the countersign learned once all are found (Sam's call).
   */
  z.strictObject({
    kind: z.literal('countersign'),
    ...At,
    order: IdSchema,
    text: z.string().min(1),
    pieces: z.int().min(2).max(5).optional(),
  }),
]);
export type Special = z.infer<typeof SpecialSchema>;

/**
 * A dungeon level as the doubled ASCII grid from docs/plan.md (Map format): cells at odd rows and
 * columns, edges between them. See docs/content-guide.md for the glyphs.
 */
/**
 * What stands on a floor cell to dress it (docs/presentation-plan.md, V4): drawn in the view and
 * on the map, never read by the rules.
 */
export const FURNITURE = ['rubble', 'bones', 'altar', 'fountain', 'brazier'] as const;
export const FurnitureSchema = z.strictObject({ at: CellSchema, kind: z.enum(FURNITURE) });
export type Furniture = z.infer<typeof FurnitureSchema>;

export const DungeonLevelSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  map: z.array(z.string()).min(3),
  links: z.array(StairsLinkSchema),
  /**
   * SRD 2.13.5: a wandering encounter check (1 in 6) every so many turns from an encounter table,
   * or null for a level with no check.
   */
  wander: z.strictObject({ every: z.int().min(1).max(6), table: IdSchema }).nullable(),
  /** The only squares the party can camp on (docs/rules-adaptation.md, Dungeon exploration). */
  safe: z.array(CellSchema),
  /** A disease the party may catch ending the day on this level (Sam's call). */
  exposure: ExposureSchema.optional(),
  secrets: z.array(SecretSchema),
  traps: z.array(TrapSchema),
  specials: z.array(SpecialSchema),
  captives: z.array(HeldCaptiveSchema),
  garrisons: z.array(GarrisonPostSchema),
  /** Dressing on plain floor cells, one a cell; absent means none. */
  furniture: z.array(FurnitureSchema).optional(),
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
