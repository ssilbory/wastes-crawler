import { z } from 'zod';
import { IdSchema } from './common.ts';

/**
 * Which part of a siege a fight is (docs/rules-adaptation.md, Sieges): a camp attacked from
 * outside, the gate fought through to enter or leave, or the party's share of an assault.
 */
export const SiegeFightSchema = z.strictObject({
  town: IdSchema,
  attacker: IdSchema,
  /** The besieging asset the party faces. */
  uid: z.string(),
  /** A held town stormed by the party alone (Phase 23b): its holder's asset, or `base`. */
  kind: z.enum(['camp', 'enter', 'exit', 'assault', 'storm']),
});
export type SiegeFight = z.infer<typeof SiegeFightSchema>;

/** A siege under way (Phase 23a): an attacker's assets camped around a settlement. */
export const SiegeSchema = z.strictObject({
  town: IdSchema,
  attacker: IdSchema,
  /** The faction holding the settlement, whose assets there and base defend it. */
  defender: IdSchema,
  /** The day it began. */
  began: z.int().min(0),
  /** The day whose end brings the next assault. */
  next: z.int().min(0),
  /** Each besieging asset's camp hex, by uid. */
  camps: z.array(z.strictObject({ uid: z.string(), col: z.int(), row: z.int() })),
  /** The party has fought in it. */
  joined: z.boolean(),
  /** The party beat a camp's group and may pass the lines once. */
  pass: z.boolean(),
  /** The day the shop last stocked when it began: it sells only what it had. */
  stock: z.int().min(0),
  /** The party's share of tonight's assault, until fought: whether the rest of it was lost. */
  gate: z.strictObject({ uid: z.string(), size: z.int().min(1), lost: z.boolean() }).nullable(),
});
export type Siege = z.infer<typeof SiegeSchema>;
