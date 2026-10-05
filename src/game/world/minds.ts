// Who will talk (docs/rules-adaptation.md, Parley in Phase 6c): people always; animals when someone
// has Animal Ken (Skills); animals and monsters when a party member's focus opens parley with them;
// the mindless never. Well-Met adds to reaction rolls (vendor/wwn-srd/1.0 Character Creation/1.6.0
// Foci.md).
import type { FocusEffect, Mind } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import { activeEffects } from '../character/equipment.ts';
import { alive, awake } from './members.ts';
import type { World } from './types.ts';

export function mindOf(data: GameData, monsterId: string): Mind {
  const m = data.content.monsterCombat.find((x) => x.id === monsterId);
  if (!m) throw new Error(`unknown monster ${monsterId}`);
  return m.mind;
}

function effects(w: World, data: GameData): FocusEffect[] {
  return alive(w)
    .filter((m) => m.character.hp.current > 0)
    .flatMap((m) => activeEffects(data, m.character.foci));
}

/** The best reaction bonus anyone conscious in the party brings; bonuses don't stack. */
export function reactionBonus(w: World, data: GameData): number {
  const bonuses = effects(w, data).flatMap((e) => (e.kind === 'reaction-bonus' ? [e.amount] : []));
  return Math.max(0, ...bonuses);
}

export interface ParleyReach {
  minds: Set<Mind>;
  evenAggressive: boolean;
}

/** The kinds of minds the party can parley with, and whether even aggressive groups listen. */
export function parleyReach(w: World, data: GameData): ParleyReach {
  const opens = effects(w, data).flatMap((e) => (e.kind === 'parley' ? [e] : []));
  const beasts: Mind[] = beastSpeaker(w, data) ? ['animal'] : [];
  return {
    minds: new Set<Mind>(['sapient', ...beasts, ...opens.flatMap((e) => e.minds)]),
    evenAggressive: opens.some((e) => e.evenAggressive),
  };
}

/** Anyone awake with Animal Ken, who can talk to beasts (docs/rules-adaptation.md, Skills). */
export const beastSpeaker = (w: World, data: GameData) =>
  w.members.some(
    (m) => awake(m) && m.character.skills[data.content.skillRules.animalKen.skill] !== undefined,
  );

/** True when every monster in the rows is an animal. */
export const allAnimals = (data: GameData, rows: readonly (readonly string[])[]) =>
  rows.flat().every((id) => mindOf(data, id) === 'animal');
