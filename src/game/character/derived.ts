import type { Attribute, Character, People } from '../../data/schemas/index.ts';
import {
  boostedModifier,
  type AttributeScores,
  type ModifierBonuses,
} from '../../rules/attributes.ts';
import {
  characterLevel,
  progressionRow,
  totalAttackBonus,
  type CastingLevelRow,
} from '../../rules/progression.ts';
import { pcSaveTarget, type SaveType } from '../../rules/saves.ts';
import { addAdjustments, ATTRIBUTES } from './attributes.ts';
import { findProgression, progressionLookup, type GameData } from './context.ts';
import type { Evaluation } from './creation.ts';
import { loadoutSummary, type EquipmentSummary } from './equipment.ts';
import { classOption } from './class-step.ts';
import { beastShape } from './beast-arts.ts';
import { formShape } from './forms.ts';
import { characterBonuses } from './shaping.ts';
import { addsInt, armoredArts, castingAllowed, effortFor, spellSlots } from './magic.ts';
import { findPeople } from './people.ts';

export interface Sheet {
  scores: AttributeScores;
  modifiers: Record<Attribute, number>;
  level: number;
  attackBonus: number;
  saves: Record<SaveType, number>;
  /** System Strain maximum: the Constitution score. */
  strainMax: number;
  size: People['size'];
  equipment: EquipmentSummary;
  /** Null for characters with no casting class. */
  magic: SheetMagic | null;
}

export interface SheetMagic {
  effort: number;
  /**
   * Spell slots of every casting class held, each at its own level, combined (Sam's call): the
   * highest spell level any reaches, and their spells cast, spell points, and prepared added
   * together, with an Invoker's Int modifier added once.
   */
  slots: CastingLevelRow;
  /** Casts with spell points: a class held is the Invoker's (1.5.11). */
  points: boolean;
  /** False while worn armor or a shield blocks casting. */
  canCast: boolean;
}

function sheetMagic(
  data: GameData,
  c: Character,
  scores: AttributeScores,
  bonuses: ModifierBonuses,
): SheetMagic | null {
  const effort = effortFor(data, c.classes, c.skills, scores, bonuses);
  const mages = Object.entries(c.classes.levels).flatMap(([id, level]) => {
    const mage = level >= 1 ? classOption(data, id)?.mage : undefined;
    return mage ? [{ mage, level }] : [];
  });
  const [first, ...more] = mages.map(({ mage, level }) => spellSlots(data, mage, level));
  if (effort === null || !first) return null;
  const combined = more.reduce(
    (all, r) => ({
      ...all,
      maxSpellLevel: Math.max(all.maxSpellLevel, r.maxSpellLevel),
      spellsCast: all.spellsCast + r.spellsCast,
      spellPoints: all.spellPoints + r.spellPoints,
      spellsPrepared: all.spellsPrepared + r.spellsPrepared,
    }),
    first,
  );
  const invoked = mages.filter((x) => addsInt(data, x.mage));
  const points = invoked.length > 0;
  const int = points ? boostedModifier(scores.int, bonuses.int) : 0;
  // The Int modifier, added once, touches only the Invoker classes' share of preparations.
  const ownPrepared = invoked.reduce(
    (n, x) => n + spellSlots(data, x.mage, x.level).spellsPrepared,
    0,
  );
  return {
    effort,
    points,
    slots: {
      ...combined,
      spellPoints: Math.max(0, combined.spellPoints + int),
      spellsPrepared: combined.spellsPrepared - ownPrepared + Math.max(0, ownPrepared + int),
    },
    // Blood Priest miracles ignore armor (1.5.5.1); so does a caster with no other tradition.
    canCast: armoredArts(data, c.classes) || castingAllowed(data, c.inventory, c.foci),
  };
}

export function finalScores(c: Character): AttributeScores {
  const { base, people, background, advancement } = c.attributes;
  return addAdjustments(addAdjustments(addAdjustments(base, people), background), advancement);
}

const SAVES: readonly SaveType[] = ['physical', 'evasion', 'mental', 'luck'];

/** Modifiers and save targets, with focus bonuses such as Developed Attribute applied. */
function modifiersAndSaves(scores: AttributeScores, level: number, bonuses: ModifierBonuses) {
  return {
    modifiers: Object.fromEntries(
      ATTRIBUTES.map((a) => [a, boostedModifier(scores[a], bonuses[a])]),
    ) as Record<Attribute, number>,
    saves: Object.fromEntries(
      SAVES.map((t) => [t, pcSaveTarget(level, scores, t, bonuses)]),
    ) as Record<SaveType, number>,
  };
}

/** A form's and the Beastmaster arts' attacks and base AC together; the better AC stands. */
function arted(shape: ReturnType<typeof formShape> | null, beast: ReturnType<typeof beastShape>) {
  const acs = [shape?.innateAc, beast.innateAc].filter((x): x is number => typeof x === 'number');
  const effects = [...(shape?.effects ?? []), ...beast.effects];
  return {
    ...(effects.length > 0 ? { formEffects: effects } : {}),
    ...(acs.length > 0 ? { formAc: Math.max(...acs) } : {}),
  };
}

/** `form` is the index of a Skinshifter's alternate form worn now, if any (forms.ts). */
export function characterSheet(c: Character, data: GameData, form: number | null = null): Sheet {
  const people = findPeople(data, c.people);
  if (!people) throw new Error(`unknown people ${c.people}`);
  const scores = finalScores(c);
  const level = characterLevel(c.classes);
  const worn = form === null ? undefined : c.forms?.[form];
  const shape = worn ? formShape(data, c, worn, scores, characterBonuses(c)) : null;
  const bonuses = shape?.bonuses ?? characterBonuses(c);
  const attackBonus = Math.max(
    totalAttackBonus(c.classes, progressionLookup(data)),
    shape?.attackFloor ?? 0,
  );
  return {
    scores,
    ...modifiersAndSaves(scores, level, bonuses),
    level,
    attackBonus,
    equipment: loadoutSummary(data, {
      entries: c.inventory,
      people,
      scores,
      bonuses,
      skills: c.skills,
      foci: c.foci,
      level,
      attackBonus,
      ...arted(shape, beastShape(c)),
    }),
    strainMax: scores.con,
    size: people.size,
    magic: sheetMagic(data, c, scores, bonuses),
  };
}

export interface Preview {
  scores: AttributeScores | null;
  modifiers: Record<Attribute, number> | null;
  /** Null until a valid class is chosen. */
  attackBonus: number | null;
  /** Null until scores exist. */
  saves: Record<SaveType, number> | null;
}

/** The live sheet for an unfinished character at 1st level. */
export function previewSheet(ev: Evaluation, classId: string | null, data: GameData): Preview {
  const scores = ev.scores;
  const progression =
    classId !== null && ev.steps.class.state === 'ok' ? findProgression(data, classId) : undefined;
  const derived = scores ? modifiersAndSaves(scores, 1, ev.modifierBonuses) : null;
  return {
    scores,
    modifiers: derived?.modifiers ?? null,
    attackBonus: progression ? progressionRow(progression, 1).attackBonus : null,
    saves: derived?.saves ?? null,
  };
}
