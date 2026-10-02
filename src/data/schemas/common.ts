import { z } from 'zod';

export const IdSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/);

/** Where a record came from in vendor/wwn-srd/. */
export const SourceSchema = z.object({
  file: z.string().min(1),
  heading: z.string().min(1),
});
export type Source = z.infer<typeof SourceSchema>;

/** A dice expression such as 2d6+4: count dice of `sides`, plus `modifier`. */
export const DiceSchema = z.object({
  count: z.int().min(1),
  sides: z.int().min(2),
  modifier: z.int(),
});
export type Dice = z.infer<typeof DiceSchema>;

export const CostSchema = z.object({
  amount: z.number().positive(),
  unit: z.enum(['cp', 'sp', 'gp']),
});
export type Cost = z.infer<typeof CostSchema>;

export const AttributeSchema = z.enum(['str', 'dex', 'con', 'int', 'wis', 'cha']);
export type Attribute = z.infer<typeof AttributeSchema>;

export const recordBase = {
  id: IdSchema,
  name: z.string().min(1),
  source: SourceSchema,
};
