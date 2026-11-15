// The locked vault or boss chest where the party stands, as data for its panel
// (docs/rules-adaptation.md, Locks and chests). Pure.
import type { GameData } from '../game/character/context.ts';
import { findItem } from '../game/character/items.ts';
import { chestHere, chestName, gearBonus, handFor } from '../game/world/chests.ts';
import type { World } from '../game/world/types.ts';

export interface ChestAction {
  /** Who would make the check, or null with no one able. */
  hand: string | null;
  /** What the party's gear does to it, in words, if anything. */
  gear: string | null;
}

export interface ChestView {
  /** "vault" or "chest". */
  name: string;
  /** What the party knows of its trap. */
  trap: string;
  /** Disarming the spotted trap, when one is spotted and still set. */
  disarm: ChestAction | null;
  pick: ChestAction;
  force: ChestAction;
}

const itemName = (data: GameData, id: string) => findItem(data, id)?.name ?? id;

export function chestView(w: World, data: GameData): ChestView | null {
  const c = chestHere(w);
  if (!c) return null;
  const { tools, crowbar } = data.content.chests;
  const hand = (m: 'pick' | 'force' | 'disarm') => handFor(w, data, m)?.character.name ?? null;
  const toolless =
    gearBonus(w, data, 'pick') < 0
      ? `${gearBonus(w, data, 'pick')} without ${itemName(data, tools.item)}`
      : null;
  const bar = gearBonus(w, data, 'force');
  const trap = {
    hidden: c.looked ? 'No trap has been spotted on it.' : 'No one has looked it over yet.',
    noticed: `A ${c.trap.name} guards it.`,
    disarmed: `Its ${c.trap.name} is disarmed.`,
    sprung: `Its ${c.trap.name} is spent.`,
  }[c.trapState];
  return {
    name: chestName(c),
    trap,
    disarm: c.trapState === 'noticed' ? { hand: hand('disarm'), gear: toolless } : null,
    pick: { hand: hand('pick'), gear: toolless },
    force: {
      hand: hand('force'),
      gear: bar > 0 ? `+${bar} with a ${itemName(data, crowbar.item).toLowerCase()}` : null,
    },
  };
}
