import { z } from 'zod';
import { IdSchema } from './common.ts';
import { ChestTrapSchema } from './chest-content.ts';
import { LootDiceSchema } from './town-content.ts';

/** A lock and the trap on it, if any, as the party knows it (docs/rules-adaptation.md, Locks and chests). */
export const LockStateSchema = z.strictObject({
  /** The lock's and its trap's difficulty. */
  difficulty: z.int().min(1),
  /** Its trap, or null for none. */
  trap: ChestTrapSchema.nullable(),
  /** Unknown, spotted, made safe, or spent by springing. */
  trapState: z.enum(['hidden', 'noticed', 'disarmed', 'sprung']),
  /** The party has had its look at it. */
  looked: z.boolean(),
  /** Heavily trapped: a harder, harsher trap. */
  heavy: z.boolean(),
});
export type LockState = z.infer<typeof LockStateSchema>;

/**
 * A locked vault, boss chest, or random chest (docs/rules-adaptation.md, Locks and chests), until
 * the party opens it.
 */
export const ChestStateSchema = LockStateSchema.extend({
  /** Where it lies: a dungeon cell or a hex, as necromancy.ts's placeKey gives it. */
  at: z.string().min(1),
  /** A ruin's vault rather than a chest. */
  vault: z.boolean(),
  /** The boss's drop, rolled on opening: the defeated, and what the fight was worth. */
  spoils: z.strictObject({ enemies: z.array(z.array(IdSchema)), xp: z.number().min(0) }).nullable(),
  /** The loot cache it holds, by dungeon, level, and cell. */
  cache: z.string().nullable(),
  /** Loot dice it holds of its own. */
  loot: z.array(LootDiceSchema).nullable(),
  /** No treasure at all: a chest golem, or an undead thing waiting inside. */
  animated: z.enum(['golem', 'undead']).nullable(),
});
export type ChestState = z.infer<typeof ChestStateSchema>;

/** A locked door below ground: its lock, its trap, and whether it is open for this visit. */
export const DoorStateSchema = LockStateSchema.extend({ opened: z.boolean() });
export type DoorState = z.infer<typeof DoorStateSchema>;
