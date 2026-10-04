// Levelling a character without a player (Phase 12f), for the balance tool and the campaign exit
// test: each level takes the first focus that fits each pick, the first arts and spells that can
// be learned, and spends skill points on the character's best combat skill (vendor/wwn-srd/2.0 The
// Rules of the Game/2.7.0 Character Advancement.md). Hit points are rolled as usual.
import type { Character } from '../../data/schemas/index.ts';
import { xpForLevel } from '../../rules/advancement.ts';
import { createRng, type Rng } from '../../rules/rng.ts';
import { advance, levelPlan, type LevelChoices, type LevelPlan } from './advance.ts';
import { classOption } from './class-step.ts';
import type { GameData } from './context.ts';
import { allowedSkills, focusInfo, type FocusChoice } from './foci.ts';
import { learnableSpells } from './magic.ts';
import { raiseSkill } from './training.ts';

const COMBAT = ['stab', 'shoot', 'punch'] as const;

/** A focus choice, with its bonus skill or attribute filled in. */
function choiceFor(data: GameData, id: string): FocusChoice {
  const f = focusInfo(data, id);
  const skill = f?.bonusSkill ? allowedSkills(data, f.bonusSkill)[0] : undefined;
  return {
    id,
    ...(skill ? { skill } : {}),
    ...(f?.attributeChoice ? { attribute: 'con' as const } : {}),
  };
}

/** The first arts and spells the plan can take. */
function learning(data: GameData, c: Character, plan: LevelPlan): Omit<LevelChoices, 'foci'> {
  const arts = plan.arts.flatMap((p) =>
    data.srd.arts
      .filter(
        (a) => a.tradition === p.tradition && !c.arts.includes(a.id) && !p.automatic.includes(a.id),
      )
      .slice(0, p.picks)
      .map((a) => a.id),
  );
  const mage = classOption(data, plan.classId)?.mage;
  const spells = mage
    ? learnableSpells(data, mage, plan.maxSpellLevel)
        .filter((s) => !c.spells.known.includes(s.id))
        .slice(0, plan.spells)
        .map((s) => s.id)
    : [];
  return { arts, spells };
}

/** The first focus choices, in content order, that make a valid level with `rest`. */
function pickFoci(
  data: GameData,
  c: Character,
  plan: LevelPlan,
  rest: Omit<LevelChoices, 'foci'>,
  chosen: FocusChoice[],
): FocusChoice[] | null {
  // Trials roll nothing that matters: only the level actually taken uses the game's RNG.
  const trial = createRng('auto-level');
  if (chosen.length === plan.focusPicks.length)
    return advance(data, c, { ...rest, foci: chosen }, trial).ok ? chosen : null;
  for (const f of data.content.focusRules) {
    const found = pickFoci(data, c, plan, rest, [...chosen, choiceFor(data, f.id)]);
    if (found) return found;
  }
  return null;
}

/** Takes the next level with the first choices that fit. */
function nextLevel(data: GameData, c: Character, rng: Rng): Character {
  const plan = levelPlan(data, c) as LevelPlan;
  const rest = learning(data, c, plan);
  const foci = pickFoci(data, c, plan, rest, []);
  if (!foci) throw new Error(`${c.name} can't level up automatically`);
  return (advance(data, c, { ...rest, foci }, rng) as { character: Character }).character;
}

/** The character at `level`, with the XP for it, levelled and trained automatically. */
export function autoLevel(data: GameData, c: Character, level: number, rng: Rng): Character {
  let next = { ...c, xp: Math.max(c.xp, xpForLevel(level)) };
  while (levelPlan(data, next)) next = nextLevel(data, next, rng);
  const best = COMBAT.reduce((a, b) => ((next.skills[b] ?? -1) > (next.skills[a] ?? -1) ? b : a));
  for (;;) {
    const raised = raiseSkill(data, next, best);
    if (!raised.ok) break;
    next = raised.character;
  }
  return { ...next, hp: { ...next.hp, current: next.hp.max } };
}
