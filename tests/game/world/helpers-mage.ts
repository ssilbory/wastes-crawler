import type { Member, World } from '../../../src/game/world/types.ts';
import { member } from './helpers.ts';

/** Fizzwick as a level-`level` High Mage with the given spells prepared. */
export function highMage(w: World, spells: string[], level = 10): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-high-mage', levels: { 'full-high-mage': level } },
    spells: { known: spells, prepared: spells },
  };
  return m;
}

export const fail = (reason: string) => ({ ok: false, reason });
