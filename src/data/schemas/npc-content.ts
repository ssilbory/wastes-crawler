import { z } from 'zod';
import { IdSchema } from './common.ts';

/**
 * A hireling for hire in any town: an SRD 3.3.0 hireling row and the SRD monster stat line it
 * fights with. Fighters take part in combat; guides, porters, and physicians stand back as
 * non-combatants. Sam's call: no daily wage, a signing fee and a share of the loot instead.
 */
export const HirelingTypeSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** The share of loot taken, as a fraction of one PC's share. */
  share: z.number().min(0.25).max(1),
  monster: IdSchema,
  role: z.enum(['fighter', 'guide', 'porter', 'physician']),
});
export type HirelingType = z.infer<typeof HirelingTypeSchema>;

/** Hireling and parley numbers (docs/rules-adaptation.md, NPCs in Phase 6c). */
export const NpcRulesSchema = z.strictObject({
  hirelings: z.array(HirelingTypeSchema).min(1),
  /** Placeholder names handed out in turn. */
  names: z.array(z.string().min(1)).min(1),
  /** Crowns paid to sign any hireling on in town. */
  signingFee: z.number().min(0),
  /** Crowns of the fee returned when a hireling is let go alive in a settlement. */
  signingRefund: z.number().min(0),
  /** SRD 3.3.0: common hirelings have a total +1 on relevant skill checks. */
  skillBonus: z.int(),
  /** Fight tiers dangerous enough to test hirelings' Morale (SRD 3.3.0). */
  moraleTiers: z.array(z.string().min(1)).min(1),
  /** A porter's stowed items. */
  porterCapacity: z.int().min(1),
  parley: z.strictObject({
    difficulty: z.int().min(2),
    /** Added to the difficulty when the group means to fight. */
    hostileExtra: z.int().min(0),
    /** A bribe's price per enemy hit die. */
    bribePerHitDie: z.number().positive(),
  }),
});
export type NpcRules = z.infer<typeof NpcRulesSchema>;

/** Someone held by an encounter group, who wants taking to a town. */
export const CaptiveSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  monster: IdSchema,
  /** The town they want to reach. */
  destination: IdSchema,
  reward: z.number().min(0),
  /** XP for each PC in the party on delivery. */
  xp: z.number().min(0).multipleOf(0.5),
  text: z.string().min(1),
});
export type Captive = z.infer<typeof CaptiveSchema>;
