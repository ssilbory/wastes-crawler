// What a member's poison and disease amount to now (docs/rules-adaptation.md, Poison and disease;
// vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury, Healing, And System Strain.md, 2.5.5).
import type { Disease } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import type { Member } from './types.ts';

export const POISONER = 'poisoner';

export function findDisease(data: GameData, id: string): Disease {
  const d = data.content.ailments.diseases.find((x) => x.id === id);
  if (!d) throw new Error(`unknown disease ${id}`);
  return d;
}

/** The disease has taken hold: its onset nights have passed. */
export const diseaseActive = (data: GameData, m: Member) =>
  m.disease !== null && m.disease.nights >= findDisease(data, m.disease.id).onsetNights;

/** Immune to poison: Unaging (1.5.14) or the Poisoner focus at level 2 (1.6.0). */
export const poisonProof = (m: Member) =>
  m.character.arts.includes('unaging') ||
  m.character.foci.some((f) => f.id === POISONER && f.level >= 2);

/** Taken off hit rolls and skill checks: Poisoned, and a penalty disease that has taken hold. */
export function ailPenalty(data: GameData, m: Member): number {
  const p = data.content.ailments.poisoned.penalty;
  const sick =
    diseaseActive(data, m) &&
    findDisease(data, (m.disease as NonNullable<Member['disease']>).id).harm.kind === 'penalty';
  return (m.poisoned ? p : 0) + (sick ? p : 0);
}
