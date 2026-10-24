import { z } from 'zod';
import { LootDiceSchema } from './town-content.ts';

const Loot = z.array(LootDiceSchema).min(1);
const Texts = z.array(z.string().min(1)).min(1);

/**
 * Hidden sites found by exploring a hex (docs/rules-adaptation.md, Explore; Sam's calls): how
 * common they are, the check for the small ones, and what each kind holds. Where they lie comes
 * from each world's seed; what a lair or a small ruin's guards are comes from the hex's own
 * encounter table.
 */
export const HiddenSiteContentSchema = z.strictObject({
  /** One wild hex in this many holds a site. */
  odds: z.int().min(2),
  /** Wis/Survive difficulty to find a cache or shrine, and the extra in difficult terrain. */
  difficulty: z.int().min(2),
  difficultTerrain: z.int().min(0),
  /** Relative odds of each kind. */
  weights: z.strictObject({
    cache: z.int().min(0),
    lair: z.int().min(0),
    ruin: z.int().min(0),
    shrine: z.int().min(0),
  }),
  cache: z.strictObject({ loot: Loot, texts: Texts }),
  lair: z.strictObject({ loot: Loot, texts: Texts }),
  ruin: z.strictObject({
    names: Texts,
    /** Levels, and each level's width and height in cells (a delve's sizes). */
    depth: z.strictObject({ min: z.int().min(1), max: z.int().max(2) }),
    size: z.strictObject({ min: z.int().min(12), max: z.int().max(15) }),
    /** Wandering checks every this many turns. */
    wanderEvery: z.int().min(1).max(6),
    cache: Loot,
    vault: Loot,
    /** Shown when the way down is found. */
    texts: Texts,
  }),
  shrines: z
    .array(
      z.strictObject({
        text: z.string().min(1),
        /** Heal everyone to full, ease a point of System Strain each, or only words. */
        boon: z.enum(['heal', 'strain', 'none']),
      }),
    )
    .min(1),
});
export type HiddenSiteContent = z.infer<typeof HiddenSiteContentSchema>;
