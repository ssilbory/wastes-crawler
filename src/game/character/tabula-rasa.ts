// Tabula Rasa (docs/rules-adaptation.md, Potions: Tabula Rasa; Sam's calls): the drinker goes back
// to 1st level keeping who they are (people, lineage, base attributes, background, and class) and
// makes their 1st-level picks anew through the creation rules (vendor/wwn-srd/1.0 Character
// Creation/: the background's picks 1.3.2, class bonus skills 1.4.0, foci 1.6.0, the free skill
// 1.7.0, and a Mage's arts and spells). They keep their name, goal, gear, crowns, strain, marks of
// being raised and reshaped flesh, and their XP, so they level back up as before (2.7.0).
import type { Character } from '../../data/schemas/index.ts';
import type { Rng } from '../../rules/rng.ts';
import { FREE_REROLLS } from './attributes.ts';
import { emptyChoices, finishCharacter, type Choices, type FinishResult } from './creation.ts';
import type { GameData } from './context.ts';

/**
 * Creation choices with the kept identity filled in and the 1st-level picks left open. The base
 * scores are named as they are; gear is none, as the drinker keeps what they carry.
 */
export function blankSlate(c: Character): Choices {
  return {
    ...emptyChoices(),
    people: c.people,
    lineage: c.lineage ?? null,
    array: { ...c.attributes.base },
    attributeMethod: { kind: 'manual', rerolls: FREE_REROLLS + 1 },
    background: { id: c.background, choice: { mode: 'pick', picks: [] } },
    classId: c.classes.current,
    forms: [],
    gear: { mode: 'shop', crowns: 0, items: [] },
    name: c.name,
    goal: c.goal,
  };
}

/** Whether the choices keep the drinker's identity, so only the 1st-level picks changed. */
function keepsIdentity(c: Character, choices: Choices): boolean {
  const base = c.attributes.base;
  return (
    choices.people === c.people &&
    choices.lineage === (c.lineage ?? null) &&
    choices.classId === c.classes.current &&
    choices.background?.id === c.background &&
    choices.array !== null &&
    Object.entries(base).every(([a, v]) => choices.array?.[a as keyof typeof base] === v)
  );
}

/**
 * The drinker at 1st level from their new picks, rolling 1st-level hit points (SRD 1.7.1). Hit
 * points left can't exceed the new maximum.
 */
export function wipeClean(data: GameData, c: Character, choices: Choices, rng: Rng): FinishResult {
  if (!keepsIdentity(c, choices))
    return { ok: false, errors: ['Tabula Rasa keeps who they are: only the picks change.'] };
  const made = finishCharacter({ ...choices, name: c.name, goal: c.goal }, data, rng);
  if (!made.ok) return made;
  const fresh = made.character;
  const { raised } = c.attributes;
  return {
    ok: true,
    character: {
      ...fresh,
      id: c.id,
      attributes: { ...fresh.attributes, ...(raised ? { raised } : {}) },
      inventory: c.inventory,
      crowns: c.crowns,
      xp: c.xp,
      strain: c.strain,
      hp: { max: fresh.hp.max, current: Math.min(c.hp.current, fresh.hp.max) },
      ...(c.shaped ? { shaped: c.shaped } : {}),
    },
  };
}
