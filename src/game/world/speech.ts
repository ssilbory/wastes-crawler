// Who speaks for the party, and with what (docs/rules-adaptation.md, Parley and Skills): Talk is
// Cha/Convince, or Animal Ken with the better of Wis and Cha to a group of nothing but animals;
// Intimidate is the better of Str and Cha with Lead; a Bluff past a standing order is
// Cha/Convince. The awake member best at the check speaks.
import type { Attribute } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { awake, bestAt } from './members.ts';
import { allAnimals } from './minds.ts';
import type { Member, World } from './types.ts';

export type Speech = 'talk' | 'intimidate' | 'bluff';

export interface SpeechCheck {
  skill: string;
  attrs: Attribute[];
}

export function speechCheck(
  data: GameData,
  enemies: readonly (readonly string[])[],
  speech: Speech,
): SpeechCheck {
  if (speech === 'intimidate') return { skill: 'lead', attrs: ['str', 'cha'] };
  const ken = data.content.skillRules.animalKen;
  if (speech === 'talk' && enemies.flat().length > 0 && allAnimals(data, enemies))
    return { skill: ken.skill, attrs: ken.attributes };
  return { skill: 'convince', attrs: ['cha'] };
}

/** The awake member best at this speech to the pending group, if anyone is awake. */
export function bestSpeaker(w: World, data: GameData, speech: Speech): Member | undefined {
  const enemies = w.encounter?.enemies ?? [];
  const { skill, attrs } = speechCheck(data, enemies, speech);
  return bestAt(data, w.members.filter(awake), skill, attrs);
}
