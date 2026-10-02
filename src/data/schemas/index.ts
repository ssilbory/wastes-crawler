import { z } from 'zod';
import { ArmorSchema } from './armor.ts';
import { CastingProgressionSchema, ClassSchema, ProgressionSchema } from './classes.ts';
import { FocusSchema } from './foci.ts';
import { GearSchema } from './gear.ts';
import { ArtSchema, SpellSchema } from './magic.ts';
import { MonsterSchema } from './monsters.ts';
import { SkillSchema } from './skills.ts';
import { WeaponSchema, WeaponTraitSchema } from './weapons.ts';

/** One entry per data/srd/<name>.json file. */
export const SrdSchemas = {
  skills: z.array(SkillSchema),
  foci: z.array(FocusSchema),
  classes: z.array(ClassSchema),
  progressions: z.array(ProgressionSchema),
  'casting-progressions': z.array(CastingProgressionSchema),
  'weapon-traits': z.array(WeaponTraitSchema),
  weapons: z.array(WeaponSchema),
  armor: z.array(ArmorSchema),
  gear: z.array(GearSchema),
  spells: z.array(SpellSchema),
  arts: z.array(ArtSchema),
  monsters: z.array(MonsterSchema),
} as const;

export type SrdFile = keyof typeof SrdSchemas;
export type SrdData = { [K in SrdFile]: z.infer<(typeof SrdSchemas)[K]> };

export * from './armor.ts';
export * from './classes.ts';
export * from './common.ts';
export * from './foci.ts';
export * from './gear.ts';
export * from './magic.ts';
export * from './monsters.ts';
export * from './skills.ts';
export * from './weapons.ts';
