// Default actions (docs/rules-adaptation.md, Initiative and actions): each character has a preset
// the player can hand a turn to instead of choosing from the command menu.
import type { DefaultPreset } from '../../data/schemas/index.ts';
import { attackWeakest, partyAction } from './ai.ts';
import { isLegal } from './commands.ts';
import type { Action, Battle, Combatant } from './types.ts';

export const PRESET_NAMES: Record<DefaultPreset, string> = {
  auto: 'Auto',
  attack: 'Attack weakest',
  defend: 'Total Defense',
  repeat: 'Repeat last command',
};

/** The preset's action; presets that can't apply this turn fall back to auto-combat. */
export function defaultAction(
  b: Battle,
  actor: Combatant,
  preset: DefaultPreset,
  last: Action | null,
): Action {
  switch (preset) {
    case 'attack':
      return attackWeakest(b, actor) ?? partyAction(b, actor);
    case 'defend':
      return { kind: 'total-defense' };
    case 'repeat':
      return last && isLegal(b, actor, last) ? last : partyAction(b, actor);
    case 'auto':
      return partyAction(b, actor);
  }
}
