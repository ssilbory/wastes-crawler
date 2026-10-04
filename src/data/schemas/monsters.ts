import { z } from 'zod';
import { DiceSchema, IdSchema, recordBase } from './common.ts';

/** The SRD 5.1.0 stat line every monster shares. */
const stats = {
  category: z.string().min(1),
  hitDice: z.int().min(1),
  ac: z.int().min(10),
  /** SRD "a": the AC comes from worn armor. */
  armored: z.boolean(),
  attackBonus: z.int().min(0),
  attacks: z.int().min(1),
  damage: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('weapon'), bonus: z.int().min(0) }),
    z.strictObject({ kind: z.literal('dice'), dice: DiceSchema }),
  ]),
  shock: z
    .discriminatedUnion('kind', [
      /** The wielded weapon's Shock plus a bonus; ignoresAc is the SRD "/-" suffix. */
      z.strictObject({ kind: z.literal('weapon'), bonus: z.int().min(0), ignoresAc: z.boolean() }),
      /** maxAc null means Shock applies regardless of the target's AC. */
      z.strictObject({
        kind: z.literal('fixed'),
        damage: z.int().min(1),
        maxAc: z.int().nullable(),
      }),
    ])
    .nullable(),
  move: z.int().positive(),
  morale: z.int().min(2).max(12),
  instinct: z.int().min(0).max(10),
  skill: z.int(),
  save: z.int().min(2).max(20),
};

/** An SRD monster, extracted from vendor/wwn-srd. */
export const MonsterSchema = z.strictObject({ ...recordBase, ...stats });

/** A monster authored for the setting in the SRD's shape (data/content/monsters.json). */
export const AuthoredMonsterSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  ...stats,
  description: z.string().min(1),
});
export type AuthoredMonster = z.infer<typeof AuthoredMonsterSchema>;

export type SrdMonster = z.infer<typeof MonsterSchema>;

/** What the engine needs of any monster, SRD or authored. */
export type Monster = Omit<z.infer<typeof MonsterSchema>, 'source'>;

/**
 * A setting monster on an existing stat line (Sam's call: reskin, so combat balance and the sims
 * hold): a new name and description over an SRD or authored monster's statistics and combat entry.
 */
export const SettingMonsterSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** The monster whose statistics, combat entry, loot, and component drops it shares. */
  base: IdSchema,
  description: z.string().min(1),
});
export type SettingMonster = z.infer<typeof SettingMonsterSchema>;
