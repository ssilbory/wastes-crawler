import { z } from 'zod';
import { IdSchema } from './common.ts';
import { ChestTrapSchema } from './chest-content.ts';

/**
 * A locked, trapped vault or boss chest left where it was won (docs/rules-adaptation.md, Locks and
 * chests), until the party opens it.
 */
export const ChestStateSchema = z.strictObject({
  /** Where it lies: a dungeon cell or a hex, as necromancy.ts's placeKey gives it. */
  at: z.string().min(1),
  /** A ruin's vault rather than a boss's chest. */
  vault: z.boolean(),
  /** Its lock's and its trap's difficulty. */
  difficulty: z.int().min(1),
  trap: ChestTrapSchema,
  /** Unknown, spotted, made safe, or spent by springing. */
  trapState: z.enum(['hidden', 'noticed', 'disarmed', 'sprung']),
  /** The party has had its look for the trap. */
  looked: z.boolean(),
  /** The boss's drop, rolled on opening: the defeated, and what the fight was worth. */
  spoils: z.strictObject({ enemies: z.array(z.array(IdSchema)), xp: z.number().min(0) }).nullable(),
  /** The loot cache it holds, by dungeon, level, and cell. */
  cache: z.string().nullable(),
});
export type ChestState = z.infer<typeof ChestStateSchema>;
