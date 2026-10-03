// Peoples and centaur lineages are house rules: docs/rules-adaptation.md (Peoples).
import type { Background, Lineage, People } from '../../data/schemas/index.ts';
import { ATTRIBUTES, type Adjustments } from './attributes.ts';
import type { GameData } from './context.ts';
import { fail, INCOMPLETE, OK, type StepStatus } from './steps.ts';

export function findPeople(data: GameData, id: string): People | undefined {
  return data.content.peoples.find((p) => p.id === id);
}

export function findLineage(people: People, id: string): Lineage | undefined {
  return people.lineages?.find((l) => l.id === id);
}

/** The people's modifiers plus the lineage's, per attribute. */
export function combinedModifiers(people: People, lineage: Lineage | undefined): Adjustments {
  const out: Adjustments = {};
  for (const a of ATTRIBUTES) {
    const total = (people.attributeModifiers[a] ?? 0) + (lineage?.attributeModifiers[a] ?? 0);
    if (total !== 0) out[a] = total;
  }
  return out;
}

export interface PeopleOutcome {
  status: StepStatus;
  /** Set once the people (and lineage, if it has them) are valid. */
  modifiers: Adjustments | null;
}

export function evaluatePeople(
  data: GameData,
  peopleId: string,
  lineageId: string | null,
): PeopleOutcome {
  if (peopleId === '') return { status: INCOMPLETE, modifiers: null };
  const people = findPeople(data, peopleId);
  if (!people) return { status: fail(`unknown people ${peopleId}`), modifiers: null };
  if (!people.lineages) {
    if (lineageId !== null) {
      return { status: fail(`the ${people.name} people has no lineages`), modifiers: null };
    }
    return { status: OK, modifiers: combinedModifiers(people, undefined) };
  }
  if (lineageId === null) return { status: INCOMPLETE, modifiers: null };
  const lineage = findLineage(people, lineageId);
  if (!lineage) {
    return { status: fail(`unknown ${people.name} lineage ${lineageId}`), modifiers: null };
  }
  return { status: OK, modifiers: combinedModifiers(people, lineage) };
}

/** A background with no peoples list is open to everyone. */
export function backgroundOpenTo(background: Background, peopleId: string): boolean {
  return !background.peoples || background.peoples.includes(peopleId);
}
