// vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury, Healing, And System Strain.md (2.5.2)
// plus the Push, Strain casting, Broken, and Rest economy house rules in docs/rules-adaptation.md.

export interface StrainState {
  strain: number;
  /** The character's Constitution score. */
  max: number;
  broken: boolean;
}

/** Voluntary sources are refused rather than pushed past the maximum. */
export type StrainSource =
  | 'push'
  | 'strain-cast'
  | 'healing'
  | 'first-aid'
  | 'potion'
  | 'condition'
  | 'overloaded'
  | 'poison'
  | 'monster';

export type StrainOutcome =
  | { kind: 'applied'; state: StrainState }
  | { kind: 'refused'; state: StrainState; reason: 'broken' | 'over-max' }
  | { kind: 'knocked-out'; state: StrainState }
  | { kind: 'dead'; state: StrainState };

const SELF_INFLICTED = new Set<StrainSource>(['push', 'strain-cast']);
const BENEFICIAL = new Set<StrainSource>(['healing', 'first-aid', 'potion']);
/** Hungry, Sleepless, Cold, and failed Overloaded saves stop at the maximum. */
const CAPPED = new Set<StrainSource>(['condition', 'overloaded']);

export function addStrain(state: StrainState, amount: number, source: StrainSource): StrainOutcome {
  if (!Number.isInteger(amount) || amount < 0) throw new Error(`invalid strain amount ${amount}`);
  const total = state.strain + amount;

  if (state.broken) {
    if (SELF_INFLICTED.has(source)) return { kind: 'refused', state, reason: 'broken' };
    const next = { ...state, strain: total };
    return total >= state.max * 2
      ? { kind: 'dead', state: next }
      : { kind: 'applied', state: next };
  }

  // Reaching the maximum from any source makes the character Broken.
  if (SELF_INFLICTED.has(source) || BENEFICIAL.has(source)) {
    if (total > state.max) return { kind: 'refused', state, reason: 'over-max' };
    return { kind: 'applied', state: { ...state, strain: total, broken: total === state.max } };
  }

  if (CAPPED.has(source)) {
    const strain = Math.min(total, state.max);
    return { kind: 'applied', state: { ...state, strain, broken: strain === state.max } };
  }

  // Poison and monster attacks: forced past the maximum, the character is knocked out instead.
  if (total > state.max) {
    return { kind: 'knocked-out', state: { ...state, strain: state.max, broken: true } };
  }
  return { kind: 'applied', state: { ...state, strain: total, broken: total === state.max } };
}

/** One point per quarter day of rest, none while Hungry, Sleepless, or Cold. Broken persists. */
export function recoverStrain(
  state: StrainState,
  quarterDays: number,
  hasCondition: boolean,
): StrainState {
  if (!Number.isInteger(quarterDays) || quarterDays < 0) {
    throw new Error(`invalid quarter days ${quarterDays}`);
  }
  if (hasCondition) return state;
  return { ...state, strain: Math.max(0, state.strain - quarterDays) };
}

/** A full rest in town clears all strain and Broken. */
export function fullRest(state: StrainState): StrainState {
  return { ...state, strain: 0, broken: false };
}

/** Broken imposes one step of disadvantage on attacks, saves, and skill checks. */
export function brokenSteps(state: StrainState): number[] {
  return state.broken ? [-1] : [];
}
