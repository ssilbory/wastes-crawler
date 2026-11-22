import { z } from 'zod';
import { IdSchema } from './common.ts';
import { SpellTraditionSchema } from './magic.ts';

/**
 * A wizard who makes scrolls, wands, staves, and rods for sale and to order (docs/rules-adaptation.md,
 * Potions, scrolls, and magic devices: Wizards; Sam's calls). Everything they make holds only
 * spells of their own tradition, and only rods of it.
 */
export const WizardSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  town: IdSchema,
  text: z.string().min(1),
  tradition: SpellTraditionSchema,
  /**
   * Their caster level, as a PC's: it sets the highest spell level they write (from `progression`)
   * and the level what they make goes off at.
   */
  level: z.int().min(1).max(10),
});
export type Wizard = z.infer<typeof WizardSchema>;

export const WizardContentSchema = z.strictObject({
  /** The SRD casting progression whose highest spell level a wizard's level reaches. */
  progression: IdSchema,
  /** Ready-made pieces each month: 0 to this many draws. */
  maxStock: z.int().min(0),
  /** How often a draw is each kind of piece; a draw nothing fits is lost. */
  draws: z.strictObject({
    scroll: z.int().min(0),
    wand: z.int().min(0),
    staff: z.int().min(0),
    rod: z.int().min(0),
  }),
  /** Ready-made pieces cost this many times their order price, as alchemists' potions do. */
  stockMultiplier: z.number().min(1),
  wizards: z.array(WizardSchema),
});
export type WizardContent = z.infer<typeof WizardContentSchema>;

/** A ready-made scroll, wand, staff, or rod: the item and the spells it holds. */
export const WizardPieceSchema = z.strictObject({
  item: IdSchema,
  spells: z.array(IdSchema),
});
export type WizardPiece = z.infer<typeof WizardPieceSchema>;

/** A wizard's month: their ready-made pieces. */
export const WizardStateSchema = z.strictObject({
  since: z.int().min(0),
  stock: z.array(WizardPieceSchema),
});
export type WizardState = z.infer<typeof WizardStateSchema>;

/** A scroll or device ordered from a wizard, collected in their town once ready. */
export const WizardOrderSchema = z.strictObject({
  wizard: IdSchema,
  ...WizardPieceSchema.shape,
  readyDay: z.int().min(0),
});
export type WizardOrder = z.infer<typeof WizardOrderSchema>;
