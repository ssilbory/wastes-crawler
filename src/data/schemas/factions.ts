import { z } from 'zod';
import { DiceSchema, recordBase } from './common.ts';

/** A faction attribute (vendor/wwn-srd/6.0 Factions/Faction Statistics.md). */
export const FactionAttributeSchema = z.enum(['force', 'cunning', 'wealth']);
export type FactionAttribute = z.infer<typeof FactionAttributeSchema>;

export const FactionMagicSchema = z.enum(['none', 'low', 'medium', 'high']);
export type FactionMagic = z.infer<typeof FactionMagicSchema>;

/**
 * An SRD faction Asset (6.8.0 to 6.10.0): the attribute and rating needed to buy it, its cost in
 * Treasure, hit points, the Magic it needs, its Attack (an attribute check and damage, or a special
 * ability) and Counter damage, and its qualities.
 */
export const FactionAssetSchema = z.strictObject({
  ...recordBase,
  attribute: FactionAttributeSchema,
  rating: z.int().min(1).max(8),
  cost: z.int().min(1),
  hp: z.int().min(1),
  magic: FactionMagicSchema,
  attack: z
    .discriminatedUnion('kind', [
      z.strictObject({
        kind: z.literal('check'),
        attacker: FactionAttributeSchema,
        defender: FactionAttributeSchema,
        /** Null when the damage is a special ability. */
        damage: DiceSchema.nullable(),
      }),
      z.strictObject({ kind: z.literal('special') }),
    ])
    .nullable(),
  counter: DiceSchema.nullable(),
  qualities: z.array(z.enum(['subtle', 'action', 'special'])),
  text: z.string().min(1),
});
export type FactionAsset = z.infer<typeof FactionAssetSchema>;
