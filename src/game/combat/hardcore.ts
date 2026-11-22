// Hardcore options in a fight (docs/rules-adaptation.md, Hardcore options; Sam's calls). Harsh
// healing builds on magical healing's System Strain (vendor/wwn-srd/2.0 The Rules of the
// Game/2.5.0 Injury, Healing, And System Strain.md, 2.5.2) and the Healer's and Blood Priest's
// healing arts (vendor/wwn-srd/1.0 Character Creation/1.5.0 Class List/1.5.9 The Healer.md,
// 1.5.5 The Blood Priest.md).
import type { Battle, Combatant } from './types.ts';

/** Healing magic, whose use after a fight harsh healing limits to once per ally. */
const HEALING = new Set(['heal', 'touch-heal', 'conjunct', 'companion-heal']);

/** The fight is over and the party holds the field (or never fought, tending a trap's fallen). */
const over = (b: Battle) => b.outcome !== null || b.escaped;

/** Whether strain casting is barred. */
export const noStrainCasting = (b: Battle): boolean => b.hardcore.noStrainCasting;

/** Whether a PC on the party's side at zero dies instead of lying Mortally Wounded. */
export const diesAtZero = (b: Battle, c: Combatant): boolean =>
  b.hardcore.deathAtZero && c.side === 'party' && c.kind === 'pc';

/**
 * The System Strain a healing art or spell lays on its target: with harsh healing, one more when
 * it brings back the Mortally Wounded or the stabilized. Healing that adds none stays free.
 */
export function healingStrain(b: Battle, target: Combatant, strain: number): number {
  if (!b.hardcore.harshHealing || strain === 0) return strain;
  return target.status === 'dying' || target.status === 'stable' ? strain + 1 : strain;
}

/** With harsh healing, an ally already healed once since the fight ended can't be healed again. */
export const healedEnough = (b: Battle, kind: string, targetId: string): boolean =>
  b.hardcore.harshHealing && over(b) && HEALING.has(kind) && b.healedAfter.has(targetId);

/** Counts healing magic used on a target once the fight is over. */
export function noteHealed(b: Battle, kind: string, targetId: string | undefined): void {
  if (targetId !== undefined && over(b) && HEALING.has(kind)) b.healedAfter.add(targetId);
}
