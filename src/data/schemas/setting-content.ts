import { z } from 'zod';
import { IdSchema } from './common.ts';

/**
 * A standing order (docs/setting.md, The binding and standing orders): what a bound garrison or
 * patrol still carries out, and the ways it can be ended without a fight (Sam's calls).
 */
export const StandingOrderSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  text: z.string().min(1),
  /** The countersign the bound still ask for; knowing it makes them stand aside. */
  countersign: z.string().min(1),
  /** A Lead check at this difficulty bluffs them; failing makes them fight. */
  bluff: z.int().min(6).max(16),
  /** A quest whose completion fulfils the order, so they stand down. */
  complete: IdSchema.optional(),
  /** A hireling type one of them offers to sign on as, once released. */
  recruit: IdSchema.optional(),
  /** Orders given on this one's authority, which end with it (Sam's call: the Warden's fall
   * releases the Sealed Vale's pass). */
  ends: z.array(IdSchema).min(1).optional(),
});
export type StandingOrder = z.infer<typeof StandingOrderSchema>;

/** Command authority (docs/setting.md): a token the bound obey, for some orders or all. */
export const AuthoritySchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  text: z.string().min(1),
  /** The orders it can countermand, or all of them. */
  commands: z.union([z.literal('all'), z.array(IdSchema).min(1)]),
});
export type Authority = z.infer<typeof AuthoritySchema>;

/** The monthly raid threat on the Dark Lands' settlements (Sam's call). */
const FreeRewardSchema = z.strictObject({ crowns: z.number().min(0), xp: z.number().min(0) });

export const SiegeRulesSchema = z.strictObject({
  /** The party's ally: sieges it fights in are alerted at once, and lifting one pays Renown. */
  ally: IdSchema,
  /** Days from a siege's start to its first assault, unless the party joins sooner. */
  firstAssault: z.int().min(1),
  /** Militia a settlement raises by its size, besides the holder's assets there. */
  militia: z.strictObject({ village: z.int().min(0), town: z.int().min(0), city: z.int().min(0) }),
  /** The defenders' militia (the Guard's stat line), and the holder's Force assets' fighters. */
  militiaMonster: IdSchema,
  forceMonster: IdSchema,
  /** Faction assets whose sieges walls don't slow (Siege Experts). */
  ignoreWalls: z.array(IdSchema),
  /** Hit points an assault lost costs the holder, besides its own fighters lost; militia are free. */
  overrun: z.int().min(0),
  /** System Strain each PC takes when an assault is lost with the party in it. */
  strain: z.int().min(0),
  /** Renown for an ally's siege lifted after the party fought in it. */
  renown: z.int().min(0),
  /** A held settlement's shop and inn charge this many times their price (Phase 23b). */
  heldPrice: z.number().min(1),
  /** A sacked or besieged settlement's prices rise by this fraction. */
  surcharge: z.number().min(0),
  /**
   * The quest to free a held settlement (Phase 23e), offered by every giver in the ally's free
   * settlements: `{town}` in its texts names the held one; the reward goes by its size.
   */
  freeQuest: z.strictObject({
    name: z.string().min(1),
    summary: z.string().min(1),
    text: z.string().min(1),
    reward: z.strictObject({
      village: FreeRewardSchema,
      town: FreeRewardSchema,
      city: FreeRewardSchema,
    }),
  }),
});
export type SiegeRules = z.infer<typeof SiegeRulesSchema>;

/**
 * The campaign's endgame (Phase 12d; Sam's calls): the warlord's clock, crafter's notes, and the
 * party's choice over the Seal of Command.
 */
export const CampaignSchema = z.strictObject({
  /** The setting in brief, shown once when a new world starts (Phase 16; docs/setting.md). */
  intro: z.strictObject({
    title: z.string().min(1),
    paragraphs: z.array(z.string().min(1)).min(1).max(6),
  }),
  clock: z.strictObject({
    /** The faction whose met goals advance the clock (Phase 13). */
    faction: IdSchema,
    segments: z.int().min(1),
    /** Segments per tier; each tier adds warlord patrols and boss reinforcements. */
    perTier: z.int().min(1),
    /** Quests turned in and captives freed that knock the clock back one segment. */
    knockback: z.strictObject({
      quests: z.array(IdSchema),
      captives: z.array(IdSchema),
      /** Damage to the clock faction's sturdiest asset with each knock back (Phase 13b). */
      damage: z.int().min(0),
    }),
  }),
  notes: z.strictObject({
    sets: z.array(z.strictObject({ id: IdSchema, name: z.string().min(1) })).min(1),
    /** Crowns a warlord's agent pays for a set, in any town. */
    sell: z.number().min(0),
    /** Crowns the giver pays for each set the party keeps, on its next visit. */
    keep: z.number().min(0),
    giver: IdSchema,
  }),
  seal: z.strictObject({
    authority: IdSchema,
    /** The quest that must be done before the choice. */
    quest: IdSchema,
    giver: IdSchema,
    /** Crowns for giving the seal to the giver. */
    give: z.number().min(0),
    /** XP each for destroying it. */
    destroyXp: z.number().min(0),
    epilogues: z.strictObject({
      destroy: z.string().min(1),
      give: z.string().min(1),
      keep: z.string().min(1),
    }),
    /** The epilogue's line on kept notes; `{n}` is the number kept. */
    notesEpilogue: z.strictObject({ none: z.string().min(1), some: z.string().min(1) }),
  }),
});
export type Campaign = z.infer<typeof CampaignSchema>;
