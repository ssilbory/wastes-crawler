// Saves in combat (vendor/wwn-srd/2.0 The Rules of the Game/2.2.0 Saving Throws.md), with the
// rear-cover save advantage in docs/rules-adaptation.md.
import { netSteps } from '../../rules/advantage.ts';
import { rollSave, type SaveResult, type SaveType } from '../../rules/saves.ts';
import { covered } from './targeting.ts';
import type { Battle, Combatant } from './types.ts';

/** A save with rear-cover advantage and Broken disadvantage. */
export function save(b: Battle, target: Combatant, type: SaveType, modifier = 0): SaveResult {
  const steps = netSteps([covered(b, target) ? 1 : 0, target.strain?.broken ? -1 : 0]);
  const repose = type === 'physical' ? target.reposePenalty : 0;
  // Augment Mortal Vitality adds the caster's Magic skill to Physical saves (4.6.0).
  const vital = type === 'physical' ? (target.vitality?.saveBonus ?? 0) : 0;
  // Sanctified Ward: +4 to every save (1.5.5.1).
  const ward = target.sanctified ? 4 : 0;
  return rollSave(b.rng, target.saves[type], {
    modifier: modifier - repose + ward + vital,
    steps,
  });
}
