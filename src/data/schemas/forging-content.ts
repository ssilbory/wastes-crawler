import { z } from 'zod';
import { AttributeSchema, DiceSchema, IdSchema } from './common.ts';
import { ComponentTypeSchema } from './crafting-content.ts';

const Targets = z.array(z.enum(['weapon', 'armor'])).min(1);

/** What a special ability does (SRD 4.9.3: some weapons and armor have additional abilities). */
export const AbilityEffectSchema = z.discriminatedUnion('kind', [
  /** Extra damage on every hit. */
  z.strictObject({ kind: z.literal('flaming'), dice: DiceSchema }),
  /** Extra damage on a hit against one kind of foe. */
  z.strictObject({
    kind: z.literal('bane'),
    against: z.enum(['undead', 'beast', 'unliving']),
    dice: DiceSchema,
  }),
  /** Armor: a bonus to saves against spells. */
  z.strictObject({ kind: z.literal('warding'), bonus: z.int().min(1) }),
  /** Hit points back to the wielder for each foe the weapon drops. */
  z.strictObject({ kind: z.literal('vampiric'), hp: z.int().min(1) }),
]);
export type AbilityEffect = z.infer<typeof AbilityEffectSchema>;

/** A special ability a magic weapon or suit of armor can carry, one per item. */
export const AbilitySchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  targets: Targets,
  text: z.string().min(1),
  /** What it adds to a commission or forging: crowns, days, and components. */
  cost: z.number().min(0),
  days: z.int().min(0),
  components: z.array(z.strictObject({ type: ComponentTypeSchema, count: z.int().min(1) })),
  effect: AbilityEffectSchema,
});
export type Ability = z.infer<typeof AbilitySchema>;

/** A flaw a forging that failed and went on anyway leaves in the item (SRD 4.10.0). */
export const FlawSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  targets: Targets,
  text: z.string().min(1),
  weapon: z.strictObject({ hit: z.int().optional(), damage: z.int().optional() }).optional(),
  armor: z.strictObject({ ac: z.int().optional(), encumbrance: z.int().optional() }).optional(),
});
export type Flaw = z.infer<typeof FlawSchema>;

/** Forging magic weapons and armor, their abilities, and their flaws. */
export const ForgingContentSchema = z.strictObject({
  /** Rolled with Int/Magic (SRD 4.10.0), by a member with this much Magic and Craft. */
  skill: IdSchema,
  attributes: z.array(AttributeSchema).min(1),
  magicLevel: z.int().min(0).max(4),
  craftLevel: z.int().min(0).max(4),
  /** The difficulty for +1, +2, and +3 (SRD 4.10.0's 10, 12, and 14). */
  difficulties: z.array(z.int().min(2)).length(3),
  /** An ability adds this much to the difficulty. */
  abilityDifficulty: z.int().min(0),
  /** Another member who could forge helps, as the SRD's apprentice. */
  assistBonus: z.int().min(0),
  /** Going on with a flaw takes this share of the first attempt's days (SRD 4.10.0: half). */
  flawTime: z.number().positive().max(1),
  /** Percent of magic gear dropped in boss fights that carries an ability. */
  dropAbilityChance: z.int().min(0).max(100),
  abilities: z.array(AbilitySchema).min(1),
  flaws: z.array(FlawSchema).min(1),
});
export type ForgingContent = z.infer<typeof ForgingContentSchema>;
