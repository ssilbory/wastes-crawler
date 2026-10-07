import { z } from 'zod';
import { IdSchema } from './common.ts';
import { CellSchema } from './dungeon-content.ts';
import { LootDiceSchema } from './town-content.ts';

const HexSchema = z.strictObject({ col: z.int().min(0), row: z.int().min(0) });

/** One step of a quest; steps run in order (docs/rules-adaptation.md, Quests in Phase 6). */
export const ObjectiveSchema = z.discriminatedUnion('kind', [
  /** A fixed encounter waiting at a hex, done when the party beats it. */
  z.strictObject({
    kind: z.literal('slay'),
    /** The region the hex is in (Phase 12: more than one region). */
    region: IdSchema,
    hex: HexSchema,
    enemies: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3),
    text: z.string().min(1),
  }),
  /** Carry a quest item, handed over on accepting, to a town. */
  z.strictObject({
    kind: z.literal('deliver'),
    item: z.string().min(1),
    to: IdSchema,
    text: z.string().min(1),
  }),
  /** Bring an NPC, who joins on accepting, to a town. Only a first step. */
  z.strictObject({
    kind: z.literal('escort'),
    name: z.string().min(1),
    monster: IdSchema,
    to: IdSchema,
    text: z.string().min(1),
  }),
  /** Reach a hex. */
  z.strictObject({
    kind: z.literal('scout'),
    region: IdSchema,
    hex: HexSchema,
    text: z.string().min(1),
  }),
  /** Delve steps (Phase 8c): reach a dungeon level. */
  z.strictObject({
    kind: z.literal('reach'),
    dungeon: IdSchema,
    level: IdSchema,
    text: z.string().min(1),
  }),
  /** A fixed encounter waiting on a dungeon cell, done when the party beats it. */
  z.strictObject({
    kind: z.literal('guardian'),
    dungeon: IdSchema,
    level: IdSchema,
    at: CellSchema,
    enemies: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3),
    /** One more of this monster in the front row per tier of the warlord's clock (Phase 12d). */
    reinforce: IdSchema.optional(),
    text: z.string().min(1),
  }),
  /** Pick up a quest item lying on a dungeon cell. */
  z.strictObject({
    kind: z.literal('retrieve'),
    dungeon: IdSchema,
    level: IdSchema,
    at: CellSchema,
    item: z.string().min(1),
    text: z.string().min(1),
  }),
]);
export type Objective = z.infer<typeof ObjectiveSchema>;

export const QuestSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  giver: IdSchema,
  /**
   * The giver who pays on turning it in, if not the one who offered it: a letter of introduction is
   * paid for by whoever it is addressed to (Sam's call).
   */
  payer: IdSchema.optional(),
  summary: z.string().min(1),
  prerequisites: z.strictObject({
    quests: z.array(IdSchema),
    /** The party's average PC level, rounded. */
    minLevel: z.int().min(1),
  }),
  /** Days to finish every step, counted from accepting; none if absent. */
  deadlineDays: z.int().min(1).optional(),
  objectives: z.array(ObjectiveSchema).min(1),
  reward: z
    .strictObject({
      crowns: z.number().min(0),
      /** SRD 2.7.0: three for an average mission. */
      xp: z.number().min(0).multipleOf(0.5),
      loot: z.array(LootDiceSchema),
      /** A raising quest: the giver raises one dead PC for free, and pays nothing else. */
      raise: z.literal(true).optional(),
      /** Standing orders whose countersigns the giver tells the party (Phase 12b). */
      countersigns: z.array(IdSchema).optional(),
      /** A token of command authority handed over (Phase 12b). */
      authority: IdSchema.optional(),
    })
    .refine(
      (r) =>
        !r.raise ||
        (r.crowns === 0 && r.xp === 0 && r.loot.length === 0 && !r.countersigns && !r.authority),
      {
        message: 'a raising quest pays nothing but the raising',
      },
    ),
});
export type Quest = z.infer<typeof QuestSchema>;

export const RaiserKindSchema = z.enum(['crypt', 'mortuary', 'temple']);

/** Someone in a town who offers quests. */
export const MissionGiverSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  town: IdSchema,
  text: z.string().min(1),
  /**
   * A necromancer's crypt, a Priest of Death's mortuary, or a Blood Priest temple (Phase 14d): raises
   * the dead and gives raising quests.
   */
  raises: RaiserKindSchema.optional(),
});
export type MissionGiver = z.infer<typeof MissionGiverSchema>;
