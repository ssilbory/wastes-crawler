// Gaining a level: vendor/wwn-srd/2.0 The Rules of the Game/2.7.0 Character Advancement.md (2.7.1:
// hit points, skill points, foci at the class table's levels, spells and arts), the Expert's Quick
// Learner (1.5.8), and class switching's first level in a new class (docs/rules-adaptation.md).
import type { Character, ClassOption, FocusPick } from '../../data/schemas/index.ts';
import { boostedModifier } from '../../rules/attributes.ts';
import { levelForXp, skillPointsPerLevel, xpForLevel } from '../../rules/advancement.ts';
import { rollMaxHp } from '../../rules/hit-points.ts';
import { hitDiceForLevels, levelUp, progressionRow } from '../../rules/progression.ts';
import type { Rng } from '../../rules/rng.ts';
import { classBonusSkills, classOption } from './class-step.ts';
import { progressionLookup, type GameData } from './context.ts';
import { characterSheet, finalScores } from './derived.ts';
import { allowedSkills, focusInfo, hasDieHard, modifierBonuses, type FocusChoice } from './foci.ts';
import {
  artBar,
  learnableSpells,
  levelArtPicks,
  spellPicks,
  spellSlots,
  type ArtPick,
} from './magic.ts';
import { creditSkill, type TrainResult } from './training.ts';

/** The three skill points a focus's bonus skill is worth when gained by advancement. */
export const FOCUS_SKILL_POINTS = 3;

export interface LevelPlan {
  /** The class the level goes into, and that class's new level. */
  classId: string;
  classLevel: number;
  focusPicks: FocusPick['category'][];
  arts: ArtPick[];
  /** New spells to learn. */
  spells: number;
  /** The highest spell level learnable at the new class level. */
  maxSpellLevel: number;
  skillPoints: number;
  quickPoints: number;
  /** A new class's tradition skills, each worth three points (2.7.1.6). */
  bonusSkills: string[];
}

export function canLevelUp(data: GameData, c: Character): boolean {
  return c.xp >= xpForLevel(characterSheet(c, data).level + 1);
}

/** What the next level brings, or null if the XP isn't there yet. */
export function levelPlan(data: GameData, c: Character): LevelPlan | null {
  if (!canLevelUp(data, c)) return null;
  const classId = c.classes.current;
  const option = classOption(data, classId);
  if (!option) throw new Error(`unknown class ${classId}`);
  const progression = progressionLookup(data)(classId);
  // Saved characters always hold a level entry, maybe 0, for their current class.
  const classLevel = (c.classes.levels[classId] as number) + 1;
  const quick = option.abilities?.includes('quick-learner') === true;
  const mage = option.mage;
  return {
    classId,
    classLevel,
    focusPicks: progressionRow(progression, classLevel).focusPicks.flatMap((p) =>
      Array<FocusPick['category']>(p.count).fill(p.category),
    ),
    arts: mage ? levelArtPicks(data, mage, classLevel, c.arts) : [],
    spells: !mage
      ? 0
      : spellPicks(
          data,
          mage,
          spellSlots(data, mage, classLevel).maxSpellLevel,
          c.spells.known,
          classLevel === 1 ? mage.startingSpells : mage.spellsPerLevel,
        ),
    maxSpellLevel: mage ? spellSlots(data, mage, classLevel).maxSpellLevel : 0,
    skillPoints: skillPointsPerLevel(false),
    quickPoints: quick ? skillPointsPerLevel(true) - skillPointsPerLevel(false) : 0,
    bonusSkills: classLevel === 1 ? classBonusSkills(data, option) : [],
  };
}

export interface LevelChoices {
  foci: FocusChoice[];
  arts: string[];
  spells: string[];
}

export type LevelResult =
  { ok: true; character: Character; hpRolled: number } | { ok: false; reason: string };

/** Warrior picks take combat foci, Expert picks non-combat ones; either takes a "both" focus. */
const fits = (slot: FocusPick['category'], category: string | null) =>
  slot === 'any' || category !== (slot === 'warrior' ? 'non-combat' : 'combat');

/** Takes one focus pick: a new focus at level 1 (its bonus skill as three points) or a level up. */
function takeFocus(
  data: GameData,
  c: Character,
  slot: FocusPick['category'],
  choice: FocusChoice,
): Character | string {
  const f = focusInfo(data, choice.id);
  if (!f || !f.pickable) return `${choice.id} can't be picked`;
  if (!fits(slot, f.category)) return `${f.name} doesn't fit a ${slot} pick`;
  if (f.requiresCaster && !characterSheet(c, data).magic)
    return `${f.name} is only for spellcasters`;
  if (f.attributeChoice) {
    if (!choice.attribute) return `${f.name} needs an attribute`;
    if (c.foci.some((h) => h.id === f.id && h.attribute === choice.attribute))
      return `${f.name} already improves ${choice.attribute}`;
    return { ...c, foci: [...c.foci, { id: f.id, level: 1, attribute: choice.attribute }] };
  }
  const held = c.foci.find((h) => h.id === f.id);
  if (held) {
    if (held.level >= f.levels.length) return `${f.name} has no next level`;
    return { ...c, foci: c.foci.map((h) => (h === held ? { ...h, level: h.level + 1 } : h)) };
  }
  const gained = { ...c, foci: [...c.foci, { id: f.id, level: 1 }] };
  if (!f.bonusSkill) return gained;
  const allowed = allowedSkills(data, f.bonusSkill);
  const skill = choice.skill ?? (allowed.length === 1 ? allowed[0] : undefined);
  if (!skill || !allowed.includes(skill)) return `${f.name} needs one of: ${allowed.join(', ')}`;
  return creditSkill(gained, skill, FOCUS_SKILL_POINTS);
}

/** Takes a focus pick owed for a focus the game took away (docs/rules-adaptation.md, Skills). */
export function takeFreeFocus(data: GameData, c: Character, choice: FocusChoice): TrainResult {
  const owed = c.advancement.freeFoci ?? 0;
  if (owed === 0) return { ok: false, reason: 'No focus pick is owed.' };
  const took = takeFocus(data, c, 'any', choice);
  if (typeof took === 'string') return { ok: false, reason: took };
  const advancement = Object.fromEntries(
    Object.entries(took.advancement).filter(([k]) => k !== 'freeFoci'),
  ) as Character['advancement'];
  const left = owed > 1 ? { ...advancement, freeFoci: owed - 1 } : advancement;
  return { ok: true, character: { ...took, advancement: left } };
}

function learn(
  data: GameData,
  c: Character,
  plan: LevelPlan,
  choices: LevelChoices,
): string | null {
  for (const p of plan.arts) {
    const chosen = choices.arts.filter(
      (id) => data.srd.arts.find((a) => a.id === id)?.tradition === p.tradition,
    );
    if (chosen.length !== p.picks) return `pick ${p.picks} ${p.tradition} arts`;
    const barred = chosen
      .map((id) => artBar(data, p.tradition, id, plan.classLevel))
      .find((why) => why);
    if (barred) return barred;
  }
  const allArts = [...c.arts, ...plan.arts.flatMap((p) => p.automatic)];
  const picked = plan.arts.reduce((n, p) => n + p.picks, 0);
  if (choices.arts.length !== picked) return `pick ${picked} arts`;
  if (choices.arts.some((id, i) => allArts.includes(id) || choices.arts.indexOf(id) !== i))
    return 'each art can be learned once';
  const option = classOption(data, plan.classId) as ClassOption;
  if (choices.spells.length !== plan.spells) return `learn ${plan.spells} spells`;
  if (!option.mage) return null;
  const learnable = new Set(
    learnableSpells(data, option.mage, plan.maxSpellLevel).map((s) => s.id),
  );
  const bad = choices.spells.find(
    (id, i) =>
      !learnable.has(id) || c.spells.known.includes(id) || choices.spells.indexOf(id) !== i,
  );
  return bad ? `${bad} can't be learned now` : null;
}

/** Takes the next level with the player's picks, rolling hit points (2.7.1.1). */
export function advance(
  data: GameData,
  c: Character,
  choices: LevelChoices,
  rng: Rng,
): LevelResult {
  const plan = levelPlan(data, c);
  if (!plan) return { ok: false, reason: `${c.name} needs ${xpForLevel(levelForXp(c.xp) + 1)} XP` };
  if (choices.foci.length !== plan.focusPicks.length)
    return { ok: false, reason: `pick ${plan.focusPicks.length} foci` };
  let next: Character = c;
  for (const [i, slot] of plan.focusPicks.entries()) {
    const took = takeFocus(data, next, slot, choices.foci[i] as FocusChoice);
    if (typeof took === 'string') return { ok: false, reason: took };
    next = took;
  }
  const problem = learn(data, c, plan, choices);
  if (problem) return { ok: false, reason: problem };
  for (const skill of plan.bonusSkills) next = creditSkill(next, skill, FOCUS_SKILL_POINTS);
  const { classes } = levelUp(next.classes);
  const scores = finalScores(next);
  const bonuses = modifierBonuses(next.foci);
  const hp = rollMaxHp(rng, {
    dice: hitDiceForLevels(classes, progressionLookup(data)),
    conModifier: boostedModifier(scores.con, bonuses.con),
    dieHard: hasDieHard(data, next.foci),
    currentMax: next.hp.max,
  });
  const gained = hp.max - next.hp.max;
  return {
    ok: true,
    hpRolled: hp.rolled,
    character: {
      ...next,
      classes,
      hp: { max: hp.max, current: next.hp.current + gained },
      arts: [...next.arts, ...plan.arts.flatMap((p) => p.automatic), ...choices.arts],
      spells: { ...next.spells, known: [...next.spells.known, ...choices.spells] },
      advancement: {
        ...next.advancement,
        skillPoints: next.advancement.skillPoints + plan.skillPoints,
        quickPoints: next.advancement.quickPoints + plan.quickPoints,
      },
    },
  };
}
