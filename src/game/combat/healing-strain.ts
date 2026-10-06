// Magical healing's System Strain in a fight (vendor/wwn-srd/2.0 The Rules of the Game/2.5.0 Injury,
// Healing, And System Strain.md, 2.5.2): healing that would push a character past their maximum is
// refused outright, and on the Broken it may kill them, as outside fights.
import { addStrain } from '../../rules/strain.ts';
import { say } from './log.ts';
import type { Combatant } from './types.ts';
import type { Battle } from './types.ts';

/** Whether the target can take this much healing strain; those without strain always can. */
export const bearsHealing = (target: Combatant, strain: number): boolean =>
  !target.strain || strain === 0 || addStrain(target.strain, strain, 'healing').kind !== 'refused';

/**
 * Lays the healing's strain on the target: false if it is refused, so no healing happens. A Broken
 * target pushed to twice their maximum dies of it.
 */
export function takeHealingStrain(b: Battle, target: Combatant, strain: number): boolean {
  if (!target.strain || strain === 0) return true;
  // Callers offer only healing the target can bear (bearsHealing), so a refusal changes nothing.
  const outcome = addStrain(target.strain, strain, 'healing');
  target.strain = outcome.state;
  if (outcome.kind === 'dead') {
    target.status = 'dead';
    say(b, `${target.name}'s body gives out under the strain.`);
    return false;
  }
  return outcome.kind === 'applied';
}
