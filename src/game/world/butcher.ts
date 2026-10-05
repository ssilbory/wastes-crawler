// Beasts feed the party instead of paying it (Sam's calls, Phase 17; docs/rules-adaptation.md,
// Resource dice). The animals beaten in a won fight make a ration die one size per so many hit dice,
// rounded up, as far as d12. The party's rations become that die, or step up one size when they
// are already at least as large.
import type { Monster } from '../../data/schemas/index.ts';
import { stepDie, type ResourceDie } from '../../rules/resource-die.ts';
import { findMonster, type GameData } from '../character/context.ts';
import { note } from './members.ts';
import type { World } from './types.ts';

/** The ration die the beasts among the slain make, or 0 for none. */
export function killDie(data: GameData, slain: readonly string[]): ResourceDie {
  const per = data.content.overlandRules.butcherHitDicePerStep;
  const steps = slain.reduce((n, id) => {
    if (data.content.monsterCombat.find((m) => m.id === id)?.mind !== 'animal') return n;
    // Content checks give every combat entry a monster.
    return n + Math.ceil((findMonster(data, id) as Monster).hitDice / per);
  }, 0);
  return stepDie(0, steps);
}

/** Butchers the beasts slain in a won fight into the rations die. */
export function butcher(w: World, data: GameData, slain: readonly string[]): void {
  const kill = killDie(data, slain);
  if (kill === 0) return;
  w.rations = kill > w.rations ? kill : stepDie(w.rations, 1);
  note(w, `The party butchers the kill. Rations: d${w.rations}.`);
}
