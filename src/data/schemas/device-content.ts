import { z } from 'zod';
import { AttributeSchema, DiceSchema, IdSchema } from './common.ts';
import { GearSchema } from './gear.ts';

/**
 * A magical device (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Devices;
 * vendor/wwn-srd/4.0 Magic and Spellcasting/4.9.0 Magic Items and Enchanted Treasures.md, 4.9.4):
 * a wand holds one spell, a staff two or three sharing charges, and a rod gives a passive effect
 * while Readied. A wand's or staff's cost is per spell level held; a rod's is its own.
 */
export const DeviceSchema = z.strictObject({
  ...GearSchema.shape,
  text: z.string().min(1),
  /** The SRD 4.10.0 creation difficulty; a wand's adds the level of its spell. */
  difficulty: z.int().min(2),
  device: z.discriminatedUnion('kind', [
    z.strictObject({
      kind: z.literal('wand'),
      maxSpellLevel: z.int().min(1).max(5),
      charges: DiceSchema,
    }),
    z.strictObject({
      kind: z.literal('staff'),
      minSpells: z.int().min(1),
      maxSpells: z.int().min(1),
      /** The spells' levels together may come to this much at most. */
      maxLevels: z.int().min(1),
      charges: DiceSchema,
    }),
    z.strictObject({ kind: z.literal('rod'), effect: z.enum(['light', 'mending', 'warding']) }),
  ]),
});
export type Device = z.infer<typeof DeviceSchema>;

/** Making devices, and how often a drop is one. */
export const DeviceContentSchema = z.strictObject({
  /** Made with Int/Magic (SRD 4.10.0), and only by a member with this much Scribing too. */
  skill: IdSchema,
  attributes: z.array(AttributeSchema).min(1),
  scribing: z.int().min(0).max(4),
  /** SRD 4.10.0: a month for a charged or low-powered permanent item. */
  days: z.int().min(1),
  /** SRD 4.10.0: an apprentice adds this to the check; here, another member who could make it. */
  assistBonus: z.int().min(0),
  /** Rod of Warding's bonus to saves against spells. */
  wardingBonus: z.int().min(1),
  /** The percent of potion drops that are devices instead. */
  dropShare: z.int().min(0).max(100),
  devices: z.array(DeviceSchema).min(1),
});
export type DeviceContent = z.infer<typeof DeviceContentSchema>;
