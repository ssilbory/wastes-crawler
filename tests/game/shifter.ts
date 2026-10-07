import type { Character, Form } from '../../src/data/schemas/index.ts';
import { starter } from './combat/helpers.ts';

export const WOLF: Form = {
  name: 'Wolf',
  humanoid: false,
  arts: ['savage-talons', 'intrinsic-armor', 'feral-prowess'],
  feral: 'dex',
};
export const WAR: Form = {
  name: 'War Shape',
  humanoid: true,
  arts: ['sculptors-beauty', 'warform'],
};

/** Snag (Dex +1, Cha -1, Survive-0) as a third-level Skinshifter class, out of armor. */
export function shifter(
  cls = 'partial-warrior-skinshifter',
  forms: Form[] = [WOLF, WAR],
  arts: string[] = ['pliant-flesh'],
): Character {
  const snag = starter('snag');
  const formArts = forms.flatMap((f) => f.arts);
  return {
    ...snag,
    classes: { current: cls, levels: { [cls]: 3 } },
    arts: [...new Set(['change-form', ...arts, ...formArts])],
    forms,
    inventory: snag.inventory.filter((e) => e.location !== 'worn'),
  };
}
