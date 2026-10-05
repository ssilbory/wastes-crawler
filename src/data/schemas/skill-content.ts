import { z } from 'zod';
import { AttributeSchema, DiceSchema, IdSchema } from './common.ts';
import { RaiserKindSchema } from './quest-content.ts';
import { TownSizeSchema } from './town-content.ts';

const Difficulty = z.int().min(2).max(20);
const Percent = z.int().min(0).max(100);

/**
 * The game's changes to the SRD skill list and what the town-and-encounter skills do
 * (docs/rules-adaptation.md, Skills).
 */
export const SkillRulesSchema = z.strictObject({
  /** SRD skills the game has no use for yet; characters holding one get `becomes` instead. */
  removed: z.array(z.strictObject({ id: IdSchema, becomes: IdSchema, why: z.string().min(1) })),
  /** Foci no longer offered; a character holding one gets a free focus pick per level instead. */
  retiredFoci: z.array(IdSchema),
  /** Skills the game adds, in the SRD's shape without a source. */
  added: z.array(
    z.strictObject({ id: IdSchema, name: z.string().min(1), description: z.string().min(1) }),
  ),
  /** The party's best Trade knocks this much off town prices and adds it to gear sold. */
  trade: z.strictObject({ percentAtZero: Percent, percentPerLevel: Percent, maxPercent: Percent }),
  /** Playing the inn's common room for the party's lodging, once a night. */
  perform: z.strictObject({
    attributes: z.array(AttributeSchema).min(1),
    difficulty: z.record(TownSizeSchema, Difficulty),
    /** Beating the difficulty by this much also earns tips. */
    tipMargin: z.int().min(1),
    tips: z.record(TownSizeSchema, DiceSchema),
  }),
  /** A prayer at a holy place, once a day per member. */
  prayer: z.strictObject({
    attributes: z.array(AttributeSchema).min(1),
    difficulty: Difficulty,
    /** The places of the dead where a prayer is heard: temples and mortuaries, not crypts. */
    places: z.array(RaiserKindSchema).min(1),
  }),
  /** Naming a monster: base difficulty plus one per `hitDicePerStep` of its hit dice. */
  know: z.strictObject({
    attributes: z.array(AttributeSchema).min(1),
    difficulty: Difficulty,
    hitDicePerStep: z.int().min(1),
  }),
  /** Talking to beasts, and the beasts who follow a handler. */
  animalKen: z.strictObject({
    skill: IdSchema,
    attributes: z.array(AttributeSchema).min(1),
    /** Beasts one handler keeps: Animal Ken level plus this. */
    beastsPerHandler: z.int().min(1),
  }),
});
export type SkillRules = z.infer<typeof SkillRulesSchema>;

/**
 * Which spells can be learned (docs/rules-adaptation.md, High Magic): those with a combat effect in
 * combat-magic.json or a use outside fights, less those left out for good.
 */
export const SpellRulesSchema = z.strictObject({
  /** Spells the game leaves out for good: nothing in play could use them. */
  excluded: z.array(IdSchema),
  /** Spells the game uses outside fights, in code (the Necromancer's raisings). */
  outsideCombat: z.array(IdSchema),
});
export type SpellRules = z.infer<typeof SpellRulesSchema>;
