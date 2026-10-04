import { z } from 'zod';
import { ArmorSchema } from './armor.ts';
import { CastingProgressionSchema, ClassSchema, ProgressionSchema } from './classes.ts';
import { FocusSchema } from './foci.ts';
import { GearBundleSchema, GearSchema } from './gear.ts';
import { ArtSchema, SpellSchema } from './magic.ts';
import { MonsterSchema } from './monsters.ts';
import { SkillSchema } from './skills.ts';
import { WeaponSchema, WeaponTraitSchema } from './weapons.ts';

/** One entry per data/srd/<name>.json file; an empty file means an extractor stopped matching. */
export const SrdSchemas = {
  skills: z.array(SkillSchema).min(1),
  foci: z.array(FocusSchema).min(1),
  classes: z.array(ClassSchema).min(1),
  progressions: z.array(ProgressionSchema).min(1),
  'casting-progressions': z.array(CastingProgressionSchema).min(1),
  'weapon-traits': z.array(WeaponTraitSchema).min(1),
  weapons: z.array(WeaponSchema).min(1),
  armor: z.array(ArmorSchema).min(1),
  gear: z.array(GearSchema).min(1),
  'gear-bundles': z.array(GearBundleSchema).min(1),
  spells: z.array(SpellSchema).min(1),
  arts: z.array(ArtSchema).min(1),
  monsters: z.array(MonsterSchema).min(1),
} as const;

export type SrdFile = keyof typeof SrdSchemas;
export type SrdData = { [K in SrdFile]: z.infer<(typeof SrdSchemas)[K]> };

export * from './armor.ts';
export * from './character.ts';
export * from './classes.ts';
export * from './common.ts';
export * from './content.ts';
export * from './crafting-content.ts';
export * from './settings.ts';
export * from './setting-content.ts';
export * from './ruin-content.ts';
export * from './equipment-content.ts';
export * from './magic-content.ts';
export * from './combat-content.ts';
export * from './foci.ts';
export * from './gear.ts';
export * from './magic.ts';
export * from './monsters.ts';
export * from './skills.ts';
export * from './weapons.ts';
export * from './roster.ts';
export * from './overland-content.ts';
export * from './world.ts';
export * from './town-content.ts';
export * from './npc-content.ts';
export * from './travel-content.ts';
export * from './quest-content.ts';
export * from './dungeon-content.ts';
export * from './economy-sim.ts';
