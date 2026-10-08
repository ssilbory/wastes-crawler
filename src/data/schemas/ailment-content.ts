// Poisons and diseases that linger (vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury,
// Healing, And System Strain.md, 2.5.5; 2.10.0 Falling and Other Hazards.md, Poisons; Sam's calls
// in docs/rules-adaptation.md, Poison and disease).
import { z } from 'zod';
import { DiceSchema, IdSchema } from './common.ts';
import { GearSchema } from './gear.ts';

/** What a disease does on each failed night save once it has taken hold. */
export const DiseaseHarmSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('strain'), amount: z.int().min(1) }),
  /** Hit points lost, never below 1. */
  z.strictObject({ kind: z.literal('hp'), dice: DiceSchema }),
  /** No harm by night; the sick take the Poisoned penalty to hit and to skill checks. */
  z.strictObject({ kind: z.literal('penalty') }),
]);
export type DiseaseHarm = z.infer<typeof DiseaseHarmSchema>;

export const DiseaseSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  text: z.string().min(1),
  /** Nights after catching it before it takes hold (SRD 2.5.5: a slower onset). */
  onsetNights: z.int().min(0),
  /** Taken off the Physical save to resist it and each night save (SRD 2.5.5: up to -4). */
  savePenalty: z.int().min(-4).max(4),
  harm: DiseaseHarmSchema,
  /** Successful night saves that end it. */
  savesToRecover: z.int().min(1),
  /** Purge Ailment needs a Wis/Heal or Int/Heal check against it (1.5.9: 8 or more). */
  purgeDifficulty: z.int().min(8).nullable(),
});
export type Disease = z.infer<typeof DiseaseSchema>;

/** A place that can sicken those who spend the night in it: `chance` in 6 each night. */
export const ExposureSchema = z.strictObject({
  disease: IdSchema,
  chance: z.int().min(1).max(6),
});
export type Exposure = z.infer<typeof ExposureSchema>;

export const AilmentContentSchema = z.strictObject({
  poisoned: z.strictObject({
    /** Taken off hit rolls and skill checks while Poisoned or sick with a penalty disease. */
    penalty: z.int().min(1),
    /** Added System Strain when a venom with a save penalty takes hold (SRD 2.10.0). */
    venomStrain: z.int().min(0),
  }),
  /** From this Healer level, Purge Ailment cures poison and disease for scene Effort (1.5.9). */
  purgeSceneLevel: z.int().min(1),
  /** Neutralizes a poison outright (SRD 2.5.5, specialized antitoxins). */
  antidote: GearSchema,
  diseases: z.array(DiseaseSchema).min(1),
});
export type AilmentContent = z.infer<typeof AilmentContentSchema>;
