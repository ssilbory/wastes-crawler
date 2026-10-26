// The Encumbrance and Overloaded house rules in docs/rules-adaptation.md, which follow the Readied
// and Stowed items of vendor/wwn-srd/2.0 The Rules of the Game/2.9.0 Encumbrance.md.

export interface Load {
  readied: number;
  stowed: number;
  readiedLimit: number;
  stowedLimit: number;
  /** Items past the two limits, which the Overloaded rule allows up to half Strength. */
  excess: number;
  state: 'ok' | 'overloaded' | 'too-heavy';
}

/** Readied up to half Strength, Stowed up to Strength (plus any bonus), both rounded down. */
export function carryLoad(
  readied: number,
  stowed: number,
  strength: number,
  stowedBonus = 0,
): Load {
  const readiedLimit = Math.floor(strength / 2);
  const stowedLimit = strength + stowedBonus;
  const excess = Math.max(0, readied - readiedLimit) + Math.max(0, stowed - stowedLimit);
  const state =
    excess === 0 ? 'ok' : excess <= Math.floor(strength / 2) ? 'overloaded' : 'too-heavy';
  return { readied, stowed, readiedLimit, stowedLimit, excess, state };
}
