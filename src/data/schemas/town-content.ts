import { z } from 'zod';

/** Loot dice, carried unrolled until a town's loot exchange (docs/rules-adaptation.md). */
export const LootDiceSchema = z.strictObject({
  count: z.int().min(1),
  sides: z.int().min(2),
});
export type LootDice = z.infer<typeof LootDiceSchema>;

/** How much crown spending and loot a town absorbs before prices rise and payouts fall. */
export const TownSizeSchema = z.enum(['village', 'town', 'city']);
export type TownSize = z.infer<typeof TownSizeSchema>;

const Crowns = z.number().positive();
const HalfSteps = z.number().min(0).multipleOf(0.5);

/** A difficulty tier: fights the benchmark row wins at least `minWinRate` of the time. */
export const XpTierSchema = z.strictObject({
  name: z.string().min(1),
  minWinRate: z.number().min(0).max(1),
  xp: HalfSteps,
});
export type XpTier = z.infer<typeof XpTierSchema>;

/** Town prices and the economy and XP house rules' numbers (docs/rules-adaptation.md). */
export const TownRulesSchema = z.strictObject({
  /** A night at the inn, per PC (SRD 3.3.1 common lifestyle, 20 sp a week). */
  innPerPc: Crowns,
  temple: z.strictObject({
    /** SRD 3.3.1 magical healing of wounds. */
    perHp: Crowns,
    cureFrail: Crowns,
    /** Raising the dead costs this times the character's level. */
    raisePerLevel: Crowns,
  }),
  /** Gear sells for this fraction of its listed price. */
  sellFraction: z.number().positive().max(1),
  spendingThresholds: z.record(TownSizeSchema, Crowns),
  /** The loot threshold as a fraction of the spending threshold. */
  lootThresholdFraction: z.number().positive(),
  /** Price rise per unit of overage past the spending threshold. */
  surchargeRate: z.number().min(0),
  /** Payout drop per unit of overage past the loot threshold. */
  lootDropRate: z.number().min(0),
  /** The economic climate's adjustment to the purse, in whole percent. */
  climate: z.strictObject({ minPercent: z.int().max(0), maxPercent: z.int().min(0) }),
  xp: z.strictObject({
    /** Highest win rate first; the last tier should start at 0. */
    tiers: z.array(XpTierSchema).min(1),
    /** A benchmark fight averaging more rounds than this moves up one tier. */
    longFightRounds: z.number().positive(),
    /** Benchmark fights simulated per encounter. */
    simFights: z.int().min(1),
  }),
});
export type TownRules = z.infer<typeof TownRulesSchema>;
