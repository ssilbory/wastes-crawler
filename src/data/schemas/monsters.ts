import { z } from 'zod';
import { DiceSchema, recordBase } from './common.ts';

export const MonsterSchema = z.object({
  ...recordBase,
  category: z.string().min(1),
  hitDice: z.int().min(1),
  ac: z.int().min(10),
  /** SRD "a": the AC comes from worn armor. */
  armored: z.boolean(),
  attackBonus: z.int().min(0),
  attacks: z.int().min(1),
  damage: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('weapon'), bonus: z.int().min(0) }),
    z.object({ kind: z.literal('dice'), dice: DiceSchema }),
  ]),
  shock: z
    .discriminatedUnion('kind', [
      /** The wielded weapon's Shock plus a bonus; ignoresAc is the SRD "/-" suffix. */
      z.object({ kind: z.literal('weapon'), bonus: z.int().min(0), ignoresAc: z.boolean() }),
      /** maxAc null means Shock applies regardless of the target's AC. */
      z.object({ kind: z.literal('fixed'), damage: z.int().min(1), maxAc: z.int().nullable() }),
    ])
    .nullable(),
  move: z.int().positive(),
  morale: z.int().min(2).max(12),
  instinct: z.int().min(0).max(10),
  skill: z.int(),
  save: z.int().min(2).max(20),
});
export type Monster = z.infer<typeof MonsterSchema>;
