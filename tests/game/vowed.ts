import type { Character } from '../../src/data/schemas/index.ts';
import { starter } from './combat/helpers.ts';

const AUTOMATIC = ['martial-style', 'unarmed-might', 'unarmored-defense'];

/** Snag (Dex +1, Str +0) as a Monk of the given level, out of armor. */
export function vowed(
  arts: string[] = AUTOMATIC,
  level = 3,
  cls = 'partial-warrior-vowed',
): Character {
  const snag = starter('snag');
  return {
    ...snag,
    classes: { current: cls, levels: { [cls]: level } },
    arts,
    inventory: snag.inventory.filter((e) => e.location !== 'worn'),
  };
}
