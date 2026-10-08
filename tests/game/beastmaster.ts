import type { Character } from '../../src/data/schemas/index.ts';
import { starter } from './combat/helpers.ts';

/** Snag (Dex +1, Cha -1, Survive-0) as a Ranger of the given level, out of armor. */
export function beastmaster(
  arts: string[] = [],
  level = 3,
  cls = 'beastmaster-partial-warrior',
): Character {
  const snag = starter('snag');
  return {
    ...snag,
    classes: { current: cls, levels: { [cls]: level } },
    arts: [...new Set(['bind-companion', ...arts])],
    inventory: snag.inventory.filter((e) => e.location !== 'worn'),
  };
}
