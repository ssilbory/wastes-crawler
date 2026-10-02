import { z } from 'zod';
import { AttributeSchema, CostSchema, DiceSchema, IdSchema, recordBase } from './common.ts';

export const WeaponTraitSchema = z.strictObject({
  ...recordBase,
  /** The table code, such as 2H or LL. */
  code: z.string().regex(/^[0-9A-Z]{1,3}$/),
  text: z.string().min(1),
});
export type WeaponTrait = z.infer<typeof WeaponTraitSchema>;

export const WeaponSchema = z.strictObject({
  ...recordBase,
  damage: DiceSchema,
  /** Unarmed attacks add the attacker's Punch skill to damage. */
  damageAddsSkill: z.boolean(),
  shock: z.strictObject({ damage: z.int().min(1), maxAc: z.int().min(10) }).nullable(),
  attributes: z.array(AttributeSchema).min(1),
  range: z.strictObject({ short: z.int().positive(), long: z.int().positive() }).nullable(),
  /** Weapon trait ids. */
  traits: z.array(IdSchema),
  cost: CostSchema.nullable(),
  encumbrance: z.int().min(0).nullable(),
});
export type Weapon = z.infer<typeof WeaponSchema>;
