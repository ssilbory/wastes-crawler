import { z } from 'zod';
import { IdSchema } from './common.ts';

/** A coach route along the road between two towns, either way (docs/rules-adaptation.md). */
export const CoachRouteSchema = z.strictObject({
  id: IdSchema,
  towns: z.tuple([IdSchema, IdSchema]),
  /** Crowns per passenger, before the town's spending surcharge. */
  fare: z.number().positive(),
  /** An ambush on 1 in this many, checked each travel day. */
  ambushDie: z.int().min(2),
});
export type CoachRoute = z.infer<typeof CoachRouteSchema>;

/** One bout on a town arena's card. People fight to yield; monsters fight to the death. */
export const ArenaBoutSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  /** Enemy rows, front first. */
  enemies: z.array(z.array(IdSchema).min(1).max(8)).min(1).max(3),
  fee: z.number().min(0),
  prize: z.number().min(0),
  toTheDeath: z.boolean(),
});
export type ArenaBout = z.infer<typeof ArenaBoutSchema>;

export const ArenaCardSchema = z.strictObject({
  town: IdSchema,
  bouts: z.array(ArenaBoutSchema).min(1),
});
export type ArenaCard = z.infer<typeof ArenaCardSchema>;

/** Coach speed and timetable. */
export const CoachRulesSchema = z.strictObject({
  /** Road hexes covered in each travelling quarter. */
  hexesPerQuarter: z.int().min(1),
  /** The quarters of the day the coach rolls (0 morning to 3 night). */
  travelQuarters: z.array(z.int().min(0).max(3)).min(1),
});
