import { z } from 'zod';
import { AttributeSchema, DiceSchema, IdSchema } from './common.ts';

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
  effect: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('damage'), dice: DiceSchema }),
    /** SRD 2.10.0: dungeon poison takes half the victim's maximum hit points. */
    z.strictObject({ kind: z.literal('poison') }),
    /** Brings the level's wanderers at once. */
    z.strictObject({ kind: z.literal('alarm') }),
  ]),
});
export type Trap = z.infer<typeof TrapSchema>;

/** A captive held on an `N` cell by a fixed group of guards (Phase 8c). */
export const HeldCaptiveSchema = z.strictObject({
  at: CellSchema,
  captive: IdSchema,
  guards: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3),
  text: z.string().min(1),
});
export type HeldCaptive = z.infer<typeof HeldCaptiveSchema>;

const At = { at: CellSchema };
/** A special square: no glyph, found by walking onto it. */
export const SpecialSchema = z.discriminatedUnion('kind', [
  /** Text shown the first time the party steps here. */
  z.strictObject({ kind: z.literal('message'), ...At, text: z.string().min(1) }),
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
  /** A clue that teaches a standing order's countersign the first time the party steps here. */
  z.strictObject({
    kind: z.literal('countersign'),
    ...At,
    order: IdSchema,
    text: z.string().min(1),
  }),
]);
export type Special = z.infer<typeof SpecialSchema>;

/**
 * A dungeon level as the doubled ASCII grid from docs/plan.md (Map format): cells at odd rows and
 * columns, edges between them. See docs/content-guide.md for the glyphs.
 */
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
  secrets: z.array(SecretSchema),
  traps: z.array(TrapSchema),
  specials: z.array(SpecialSchema),
  captives: z.array(HeldCaptiveSchema),
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
