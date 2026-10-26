import { z } from 'zod';
import { PeopleLookSchema } from './figure-content.ts';
import { CharacterSchema } from './character.ts';
import { AttributeSchema, IdSchema } from './common.ts';
import {
  EquipmentRulesSchema,
  FocusEffectSchema,
  ShieldSchema,
  StartingPackageSchema,
} from './equipment-content.ts';
import { CombatMagicSchema, MonsterCombatSchema } from './combat-content.ts';
import { ClassOptionSchema, MagicEffectsSchema, TraditionSchema } from './magic-content.ts';
import {
  EncounterTableSchema,
  MishapSchema,
  OverlandRulesSchema,
  RealmSchema,
  RegionSchema,
  TerrainSchema,
} from './overland-content.ts';
import { GroveSchema } from './grove-content.ts';
import { WarlordContentSchema } from './warlord-content.ts';
import { HiddenSiteContentSchema } from './hidden-site-content.ts';
import { AilmentContentSchema } from './ailment-content.ts';
import { SkillRulesSchema, SpellRulesSchema } from './skill-content.ts';
import { TownRulesSchema } from './town-content.ts';
import { SettingsDefaultsSchema, SoundCueSchema } from './settings.ts';
import {
  AuthoritySchema,
  CampaignSchema,
  RaidRulesSchema,
  StandingOrderSchema,
} from './setting-content.ts';
import { RuinSchema } from './ruin-content.ts';
import { AlchemyContentSchema } from './alchemy-content.ts';
import { ScrollContentSchema } from './scroll-content.ts';
import { DeviceContentSchema } from './device-content.ts';
import { ForgingContentSchema } from './forging-content.ts';
import {
  ComponentSchema,
  CraftingRulesSchema,
  CraftsmanSchema,
  ModSchema,
} from './crafting-content.ts';
import { CaptiveSchema, NpcRulesSchema } from './npc-content.ts';
import { MountRulesSchema } from './mount-content.ts';
import { ArenaCardSchema, CoachRouteSchema, CoachRulesSchema } from './travel-content.ts';
import { MissionGiverSchema, QuestSchema } from './quest-content.ts';
import { AuthoredMonsterSchema, SettingMonsterSchema } from './monsters.ts';
import { DungeonSchema, RuinTrapSchema } from './dungeon-content.ts';
import { MapGenSchema } from './map-gen-content.ts';
import { FactionContentSchema } from './faction-content.ts';

const contentBase = {
  id: IdSchema,
  name: z.string().min(1),
  description: z.string().min(1),
};

const Modifiers = z.partialRecord(AttributeSchema, z.int().min(-4).max(4));

/** What a focus grants as a bonus skill the first time it is taken (SRD 1.2.2, 2.7.1.6). */
export const BonusSkillSchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('skill'), skill: IdSchema }),
  z.strictObject({ kind: z.literal('one-of'), skills: z.array(IdSchema).min(2) }),
  z.strictObject({ kind: z.literal('any-combat') }),
  z.strictObject({ kind: z.literal('any') }),
  z.strictObject({ kind: z.literal('any-except'), except: z.array(IdSchema).min(1) }),
]);
export type BonusSkill = z.infer<typeof BonusSkillSchema>;

/** Which class focus picks may take a focus; see the Foci rules in docs/rules-adaptation.md. */
export const FocusCategorySchema = z.enum(['combat', 'non-combat', 'both']);
export type FocusCategory = z.infer<typeof FocusCategorySchema>;

/**
 * How the game uses an SRD focus. `later` foci wait for the systems they need; `excluded` ones
 * don't fit the setting. `attributeChoice` marks Developed Attribute; `dieHard` marks the extra
 * hit points of Die Hard.
 */
export const FocusRuleSchema = z.strictObject({
  id: IdSchema,
  availability: z.enum(['pickable', 'later', 'excluded']),
  category: FocusCategorySchema,
  bonusSkill: BonusSkillSchema.optional(),
  attributeChoice: z.literal(true).optional(),
  dieHard: z.literal(true).optional(),
  /** Only characters with a spellcasting class may take it. */
  requiresCaster: z.literal(true).optional(),
  effects: z.array(FocusEffectSchema).optional(),
});
export type FocusRule = z.infer<typeof FocusRuleSchema>;

/** A people's signature focus, authored in the SRD focus format. */
export const RacialFocusSchema = z.strictObject({
  ...contentBase,
  levels: z
    .array(z.strictObject({ level: z.int().min(1).max(2), text: z.string().min(1) }))
    .min(1)
    .max(2),
  bonusSkill: BonusSkillSchema.optional(),
  effects: z.array(FocusEffectSchema).optional(),
});
export type RacialFocus = z.infer<typeof RacialFocusSchema>;

/** A people's sub-type, such as a centaur's animal half; its modifiers add to the people's. */
export const LineageSchema = z.strictObject({
  ...contentBase,
  attributeModifiers: Modifiers,
  /** Added to the people's signature foci. */
  signatureFoci: z.array(IdSchema),
});
export type Lineage = z.infer<typeof LineageSchema>;

/** A playable people; see the Peoples rules in docs/rules-adaptation.md. */
export const PeopleSchema = z.strictObject({
  ...contentBase,
  /** Added to generated scores; the result stays within 3–18. */
  attributeModifiers: Modifiers,
  size: z.enum(['small', 'standard', 'large']),
  /** How its members are drawn in a fight; presentation only. */
  look: PeopleLookSchema,
  /** Racial foci every member gets for free (ids in racial-foci.json). */
  signatureFoci: z.array(IdSchema),
  /** SRD foci that fill the remaining racial focus slots, up to three in all. */
  racialFocusPicks: z.array(IdSchema),
  /** Wears barding in a second armor slot (docs/rules-adaptation.md, Centaur barding). */
  barding: z.literal(true).optional(),
  /** When present, every member must belong to one lineage. */
  lineages: z.array(LineageSchema).min(2).optional(),
});
export type People = z.infer<typeof PeopleSchema>;

export const AttributePoolSchema = z.enum(['any', 'physical', 'mental']);
export type AttributePool = z.infer<typeof AttributePoolSchema>;

/** Background table entries, in the SRD 1.3 format. */
export const LearningEntrySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('skill'), skill: IdSchema }),
  /** Stab, Shoot, or Punch, chosen by the player. */
  z.strictObject({ kind: z.literal('any-combat') }),
]);
export type LearningEntry = z.infer<typeof LearningEntrySchema>;

export const GrowthEntrySchema = z.discriminatedUnion('kind', [
  z.strictObject({ kind: z.literal('skill'), skill: IdSchema }),
  z.strictObject({ kind: z.literal('any-combat') }),
  /** Any non-magical skill, chosen by the player. */
  z.strictObject({ kind: z.literal('any-skill') }),
  /** +2 may be split between two attributes of the pool. */
  z.strictObject({
    kind: z.literal('attribute'),
    amount: z.union([z.literal(1), z.literal(2)]),
    pool: AttributePoolSchema,
  }),
]);
export type GrowthEntry = z.infer<typeof GrowthEntrySchema>;

export const BackgroundSchema = z.strictObject({
  ...contentBase,
  freeSkill: IdSchema,
  /** The peoples who may take this background; absent means every people. */
  peoples: z.array(IdSchema).min(1).optional(),
  /** Rolled on a d6. */
  growth: z.array(GrowthEntrySchema).length(6),
  /** Rolled on a d8, or picked twice. */
  learning: z.array(LearningEntrySchema).length(8),
});
export type Background = z.infer<typeof BackgroundSchema>;

/** Characters in formation slots: two rows of four. */
const PlacedPartySchema = z
  .array(
    z.strictObject({
      row: z.int().min(0).max(1),
      column: z.int().min(0).max(3),
      character: CharacterSchema,
    }),
  )
  .min(1)
  .max(8);

export const ContentSchemas = {
  peoples: z.array(PeopleSchema).min(1),
  backgrounds: z.array(BackgroundSchema).min(1),
  racialFoci: z.array(RacialFocusSchema).min(1),
  focusRules: z.array(FocusRuleSchema).min(1),
  shields: z.array(ShieldSchema).min(1),
  startingPackages: z.array(StartingPackageSchema).min(1),
  equipmentRules: EquipmentRulesSchema,
  traditions: z.array(TraditionSchema).min(1),
  classOptions: z.array(ClassOptionSchema).min(1),
  monsterCombat: z.array(MonsterCombatSchema).min(1),
  combatMagic: z.array(CombatMagicSchema).min(1),
  terrains: z.array(TerrainSchema).min(1),
  regions: z.array(RegionSchema).min(1),
  /** Sets of shipped regions played without the campaign's story. */
  realms: z.array(RealmSchema),
  encounterTables: z.array(EncounterTableSchema).min(1),
  mishaps: z.array(MishapSchema).min(1),
  overlandRules: OverlandRulesSchema,
  townRules: TownRulesSchema,
  skillRules: SkillRulesSchema,
  spellRules: SpellRulesSchema,
  magicEffects: MagicEffectsSchema,
  npcRules: NpcRulesSchema,
  mountRules: MountRulesSchema,
  captives: z.array(CaptiveSchema).min(1),
  coachRoutes: z.array(CoachRouteSchema).min(1),
  coachRules: CoachRulesSchema,
  arenaCards: z.array(ArenaCardSchema).min(1),
  missionGivers: z.array(MissionGiverSchema).min(1),
  quests: z.array(QuestSchema).min(1),
  /** Monsters authored for the setting, alongside the SRD's. */
  monsters: z.array(AuthoredMonsterSchema),
  dungeons: z.array(DungeonSchema),
  /** How the overland map editor rolls a random region. */
  mapGen: MapGenSchema,
  /** Setting monsters on existing stat lines; their combat entries are added on loading. */
  settingMonsters: z.array(SettingMonsterSchema),
  standingOrders: z.array(StandingOrderSchema),
  authorities: z.array(AuthoritySchema),
  raidRules: RaidRulesSchema,
  campaign: CampaignSchema,
  ruins: z.array(RuinSchema),
  /** The kinds of trap the ruin generators draw from. */
  ruinTraps: z.array(RuinTrapSchema).min(1),
  groves: z.array(GroveSchema),
  warlords: WarlordContentSchema,
  hiddenSites: HiddenSiteContentSchema,
  factions: FactionContentSchema,
  ailments: AilmentContentSchema,
  craftingRules: CraftingRulesSchema,
  components: z.array(ComponentSchema).min(1),
  mods: z.array(ModSchema).min(1),
  craftsmen: z.array(CraftsmanSchema),
  alchemy: AlchemyContentSchema,
  scrolls: ScrollContentSchema,
  devices: DeviceContentSchema,
  forging: ForgingContentSchema,
  settingsDefaults: SettingsDefaultsSchema,
  soundCues: z.array(SoundCueSchema).min(1),
  /** The ready-made party offered when setting out with no characters of one's own. */
  starterParty: PlacedPartySchema,
  /** The old starter party, kept as an arena opponent beside the starter party. */
  testParty: PlacedPartySchema,
} as const;
export type ContentData = {
  [K in keyof typeof ContentSchemas]: z.infer<(typeof ContentSchemas)[K]>;
};
