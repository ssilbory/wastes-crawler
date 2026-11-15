// The locked chest, vault, or door before the party, as data for its popup
// (docs/rules-adaptation.md, Locks and chests). Pure.
import type { LockState } from '../data/schemas/index.ts';
import type { GameData } from '../game/character/context.ts';
import { findItem } from '../game/character/items.ts';
import { lockedDoorAhead } from '../game/dungeon/doors.ts';
import { chestHere, chestName } from '../game/world/chests.ts';
import { gearBonus, handFor, type Work } from '../game/world/lockwork.ts';
import type { World } from '../game/world/types.ts';

export interface LockAction {
  /** Who would make the check, or null with no one able. */
  hand: string | null;
  /** What the party's gear does to it, in words, if anything. */
  gear: string | null;
}

export interface LockView {
  kind: 'chest' | 'vault' | 'door';
  /** Where it is, so a popup closed on it opens again only on coming back. */
  at: string;
  /** What the party knows of its trap, or of what stirs inside. */
  trap: string;
  /** Disarming the spotted trap, when one is spotted and still set. */
  disarm: LockAction | null;
  pick: LockAction;
  force: LockAction;
  /** "Force it open", or "Break it down" for a door, which is loud. */
  forceLabel: string;
  /** A warning that forcing may bring trouble, if it does. */
  noise: string | null;
}

const itemName = (data: GameData, id: string) => findItem(data, id)?.name ?? id;

/** What the party knows of the lock's trap. */
export function trapText(l: Pick<LockState, 'trap' | 'trapState' | 'looked'> | null): string {
  if (!l || !l.looked) return 'No one has looked it over yet.';
  if (l.trapState === 'noticed')
    return l.trap ? `A ${l.trap.name} guards it.` : 'Something stirs inside it.';
  if (l.trapState === 'disarmed') return `Its ${l.trap?.name ?? 'trap'} is disarmed.`;
  if (l.trapState === 'sprung') return `Its ${l.trap?.name ?? 'trap'} is spent.`;
  return 'No trap has been spotted on it.';
}

function actions(w: World, data: GameData) {
  const { tools, crowbar } = data.content.chests;
  const hand = (m: Work) => handFor(w, data, m)?.character.name ?? null;
  const pickBonus = gearBonus(w, data, 'pick');
  const toolless = pickBonus < 0 ? `${pickBonus} without ${itemName(data, tools.item)}` : null;
  const bar = gearBonus(w, data, 'force');
  const barText = bar > 0 ? `+${bar} with a ${itemName(data, crowbar.item).toLowerCase()}` : null;
  return {
    disarm: { hand: hand('disarm'), gear: toolless },
    pick: { hand: hand('pick'), gear: toolless },
    force: { hand: hand('force'), gear: barText },
  };
}

/** The chest or vault where the party stands, else the locked door ahead, or null. */
export function lockView(w: World, data: GameData): LockView | null {
  const a = actions(w, data);
  const c = chestHere(w);
  if (c)
    return {
      kind: chestName(c),
      at: c.at,
      trap: trapText(c),
      disarm: c.trap && c.trapState === 'noticed' ? a.disarm : null,
      pick: a.pick,
      force: a.force,
      forceLabel: 'Force it open',
      noise: null,
    };
  const door = lockedDoorAhead(w, data);
  const s = w.dungeon;
  if (!door || !s) return null;
  const known = door.known;
  return {
    kind: 'door',
    at: `${s.dungeon}/${s.level}/${s.at.x},${s.at.y},${s.facing}`,
    trap: trapText(known),
    disarm: known?.trap && known.trapState === 'noticed' ? a.disarm : null,
    pick: a.pick,
    force: a.force,
    forceLabel: 'Break it down',
    noise: data.content.chests.doors.noise > 0 ? 'Loud: it may bring the wanderers.' : null,
  };
}
