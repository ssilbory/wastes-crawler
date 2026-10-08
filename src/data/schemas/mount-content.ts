import { z } from 'zod';
import { AttributeSchema, IdSchema } from './common.ts';

/**
 * A mount for sale in any market (docs/rules-adaptation.md, Mounts): the SRD 3.2.0 beast it stands
 * in for sets its price, and vendor/wwn-srd/2.0 The Rules of the Game/2.12.0 Wilderness
 * Exploration and Expeditions.md (2.12.3) its loads. Riding mounts stay out of fights, war mounts
 * fight beside their riders, and pack mounts take an NPC slot and are never ridden.
 */
export const MountTypeSchema = z.strictObject({
  id: IdSchema,
  /** The monster it is drawn and fights as. */
  monster: IdSchema,
  role: z.enum(['riding', 'war', 'pack']),
  /** Crowns at the market. */
  price: z.number().positive(),
  /** The sizes of people who can ride it; empty for a pack mount. */
  riderSizes: z.array(z.enum(['small', 'standard'])),
  /** Stowed encumbrance carried beside a rider, and without one. */
  loadRidden: z.int().min(0),
  loadUnridden: z.int().min(1),
  /** Monsters a handler can keep as this mount when one is offered after a parley. */
  tameFrom: z.array(IdSchema),
});
export type MountType = z.infer<typeof MountTypeSchema>;

export const MountRulesSchema = z.strictObject({
  mounts: z.array(MountTypeSchema).min(1),
  /** Calming a war mount at the start of a fight (SRD 2.12.3: Cha/Ride against 8 or more). */
  ride: z.strictObject({
    skill: IdSchema,
    attributes: z.array(AttributeSchema).min(1),
    difficulty: z.int().min(2),
  }),
  /** Added to the watcher's slip-away check when every PC rides or is a centaur. */
  slipAwayBonus: z.int().min(0),
});
export type MountRules = z.infer<typeof MountRulesSchema>;
