import { z } from 'zod';
import { IdSchema } from './common.ts';

// Major projects, institutions, recruits, and Workings (docs/rules-adaptation.md, Major projects,
// institutions, and recruits; vendor/wwn-srd/7.0 Major Projects/, vendor/wwn-srd/4.0 Magic and
// Spellcasting/4.8.0 Building Magical Workings.md). Projects and Renown play from Phase 22a.

/** SRD 7.2.0: how likely the change is (base difficulty 1, 2, 4). */
export const ProbabilitySchema = z.enum(['plausible', 'improbable', 'impossible']);
/** SRD 7.3.0: how many people it touches (×2 to ×32). */
export const ScopeSchema = z.enum(['village', 'city', 'region', 'kingdom', 'world']);
/** SRD 7.4.0: the greatest power against it (×2 to ×16). */
export const OppositionLevelSchema = z.enum(['minor', 'local', 'major', 'king']);

/** How an opposing power is beaten, so the next greatest counts instead. */
const BeatenSchema = z.discriminatedUnion('kind', [
  /** The faction has no asset or base left at that location (faction-content.ts). */
  z.strictObject({ kind: z.literal('faction-gone'), faction: IdSchema, at: IdSchema }),
  /** That quest is turned in. */
  z.strictObject({ kind: z.literal('quest'), quest: IdSchema }),
  /** Every loot cache in that hand-made dungeon is taken: it is cleared. */
  z.strictObject({ kind: z.literal('dungeon'), dungeon: IdSchema }),
]);

export const OppositionSchema = z.strictObject({
  /** As the project screen names it: "the Dawnwall Bastion". */
  name: z.string().min(1),
  level: OppositionLevelSchema,
  /** Any one of these beats it; none: only paying through it (SRD 7.6.0, lingering trouble). */
  beaten: z.array(BeatenSchema),
});

export const DifficultySchema = z.strictObject({
  probability: ProbabilitySchema,
  scope: ScopeSchema,
  /** Greatest first; none means ×1. */
  opposition: z.array(OppositionSchema),
  /** The people affected are against it: ×2. */
  popular: z.boolean(),
});

/** What a finished project or Working changes in play. */
export const ProjectEffectSchema = z.discriminatedUnion('kind', [
  /** A raid on the settlement fails this often before it is fought; a sacking there hurts less. */
  z.strictObject({ kind: z.literal('raid-guard'), at: IdSchema, percent: z.int().min(1).max(100) }),
  /** A raid on the settlement is known this many days ahead instead of the usual. */
  z.strictObject({ kind: z.literal('raid-warning'), at: IdSchema, days: z.int().min(1) }),
  /** An existing coach route: a bigger ambush die (rarer ambushes) and a cheaper fare. */
  z.strictObject({
    kind: z.literal('road'),
    route: IdSchema,
    ambushDie: z.int().min(2),
    fareCut: z.int().min(0),
  }),
  /** A new coach route between two settlements of one map. */
  z.strictObject({
    kind: z.literal('coach'),
    towns: z.tuple([IdSchema, IdSchema]),
    fare: z.int().min(1),
    ambushDie: z.int().min(2),
  }),
  /** A tithe ends on a map: its villages pay more, and the faction that took it patrols less. */
  z.strictObject({
    kind: z.literal('tithe'),
    region: IdSchema,
    faction: IdSchema.optional(),
    sellPercent: z.int().min(1),
    patrolPercent: z.int().min(1).max(100),
  }),
  /** Forage and hunting within `radius` hexes of the settlement are this much easier. */
  z.strictObject({
    kind: z.literal('forage'),
    at: IdSchema,
    radius: z.int().min(1),
    bonus: z.int().min(1),
  }),
  /** Water dice refill to the top at the settlement for nothing. */
  z.strictObject({ kind: z.literal('water'), at: IdSchema }),
  /** Work days at the party's workshop there go this much faster. */
  z.strictObject({ kind: z.literal('workshop-pace'), at: IdSchema, percent: z.int().min(1) }),
  /** The Faithful can't empty that crypt, and oppose no crypt there. */
  z.strictObject({ kind: z.literal('grave-ward'), at: IdSchema }),
]);
export type ProjectEffect = z.infer<typeof ProjectEffectSchema>;

/** Building work on site: crowns for materials, then PC work days (difficulty 8). */
export const BuildSchema = z.strictObject({
  crowns: z.int().min(0),
  days: z.int().min(1),
  /** The fitting trade (Building skills). */
  skill: IdSchema,
  /** Plain labor helps too. */
  exert: z.boolean(),
});

/** A quest or dungeon tied to a project, taking this share off its difficulty (SRD 7.5.0). */
const AdventureSchema = z.strictObject({
  quest: IdSchema.optional(),
  dungeon: IdSchema.optional(),
  percent: z.int().min(1).max(100),
});

export const ProjectSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  kind: z.enum(['fortify', 'road', 'grip', 'restore']),
  region: IdSchema,
  /** The settlement, or a site on the map, it is worked from. */
  at: IdSchema,
  /** What the project screen says about it. */
  text: z.string().min(1),
  difficulty: DifficultySchema,
  build: BuildSchema.optional(),
  adventures: z.array(AdventureSchema),
  /** Other projects that must be finished first. */
  after: z.array(IdSchema),
  effect: ProjectEffectSchema,
  /** Its line in the campaign's ending. */
  ending: z.string().min(1),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ServiceSchema = z.enum([
  'workshop',
  'arena',
  'alchemist',
  'crypt',
  'mortuary',
  'temple',
]);

/** An institution any settlement lacking it can build, with the specialist who runs it. */
export const InstitutionSchema = z.strictObject({
  service: ServiceSchema,
  build: BuildSchema,
  probability: ProbabilitySchema,
  opposition: z.array(OppositionSchema),
  specialist: z.strictObject({
    /** "a journeyman smith". */
    name: z.string().min(1),
    /** A journeyman hired at a tavern where this service already stands. */
    hireFee: z.int().min(1),
    /** Freed captives who may settle as this specialist instead of taking their reward. */
    captives: z.array(IdSchema),
  }),
});
export type Institution = z.infer<typeof InstitutionSchema>;

/** A Working (SRD 4.8.0) on the first list. */
export const WorkingSchema = z.strictObject({
  id: IdSchema,
  name: z.string().min(1),
  degree: z.enum(['trivial', 'minor', 'major', 'great', 'supreme']),
  /** The degree's points before the area's multiplier. */
  points: z.int().min(1).max(64),
  area: z.enum(['room', 'building', 'village', 'city', 'region']),
  /**
   * Where it may stand: any settlement, one with that service, one walled by a finished fortify
   * project (the magic needs the wall built first; SRD 4.8.2), or one on a coach route.
   */
  needs: z.discriminatedUnion('kind', [
    z.strictObject({ kind: z.literal('settlement') }),
    z.strictObject({ kind: z.literal('service'), service: ServiceSchema }),
    z.strictObject({ kind: z.literal('walled') }),
    z.strictObject({ kind: z.literal('coach-stop') }),
  ]),
  text: z.string().min(1),
  /** The effect, made for the place it stands. */
  effect: z.enum(['raid-warning', 'raid-guard', 'road', 'water', 'workshop-pace', 'grave-ward']),
  /** Its size: days of warning, percent, or the ambush die; 0 where the effect has none. */
  amount: z.int().min(0),
  ending: z.string().min(1),
});
export type Working = z.infer<typeof WorkingSchema>;

export const ProjectContentSchema = z.strictObject({
  /** Renown for each (Earning Renown). */
  renown: z.strictObject({
    quest: z.int().min(0),
    boss: z.int().min(0),
    captive: z.int().min(0),
    warlord: z.int().min(0),
  }),
  /** SRD 7.5.0's table at 1/50: crowns a point for each band of points bought. */
  buying: z.array(z.strictObject({ points: z.int().min(1), crowns: z.int().min(1) })).min(1),
  /** The allied faction whose help halves (Faction help), and the kinds it suits. */
  help: z.strictObject({ faction: IdSchema, suits: z.array(z.string().min(1)) }),
  /** SRD 4.8.2 at 1/50. */
  workingCrownsPerPoint: z.int().min(1),
  /** A hired mage's help with a design: the hireling, the fee, and the points they add. */
  hiredMage: z.strictObject({ hireling: IdSchema, fee: z.int().min(1), points: z.int().min(1) }),
  projects: z.array(ProjectSchema),
  institutions: z.array(InstitutionSchema),
  workings: z.array(WorkingSchema),
});
export type ProjectContent = z.infer<typeof ProjectContentSchema>;
