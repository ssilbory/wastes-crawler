// Paying for a spell: a spell slot while any are left today, then spell points, a spell's level in
// points each (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.11 The Invoker.md;
// docs/rules-adaptation.md, Spell points).

/** What a caster has left today: slots from slot casters, points from the Invoker. */
export interface SpellPool {
  spellsLeft: number;
  pointsLeft: number;
}

export const canPay = (p: SpellPool, level: number): boolean =>
  p.spellsLeft > 0 || p.pointsLeft >= level;

/** The pool after paying: a slot if one is left, else the spell's level in points. */
export function payFor(p: SpellPool, level: number): SpellPool {
  if (!canPay(p, level)) throw new Error(`nothing left to pay for a level-${level} spell`);
  return p.spellsLeft > 0
    ? { spellsLeft: p.spellsLeft - 1, pointsLeft: p.pointsLeft }
    : { spellsLeft: p.spellsLeft, pointsLeft: p.pointsLeft - level };
}
