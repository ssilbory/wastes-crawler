// Light underground (docs/rules-adaptation.md, Resource dice and Dungeon exploration): a fresh torch
// burns at d6 and a pint of oil fills the lantern to d12. The light in use rolls its die each
// exploration turn and after each fight, stepping down on a 1 or 2 (src/rules/resource-die.ts).
// A Dungeoneering Kit holds six torches, drawn once per kit per trip to town (SRD 3.2.1 leaves a
// bundle's contents to the GM: vendor/wwn-srd/3.0 Equipment, Armor, and Weapons/3.2.0 Adventuring
// Gear.md).
import { useResource, type ResourceDie } from '../../rules/resource-die.ts';
import { alive, note } from '../world/members.ts';
import type { Member, World } from '../world/types.ts';
import type { GameData } from '../character/context.ts';
import { onSpecial } from './specials.ts';

export const TORCH_DIE: ResourceDie = 6;
export const LANTERN_DIE: ResourceDie = 12;
export const KIT_TORCHES = 6;
const KIT = 'dungeoneering-kit';

/** How many of an item the living members carry. */
export function carried(w: World, id: string): number {
  return alive(w).reduce(
    (n, m) =>
      n + m.character.inventory.filter((e) => e.id === id).reduce((a, e) => a + e.quantity, 0),
    0,
  );
}

/** Uses up one of an item from the first living member carrying it; someone must carry it. */
function takeOne(w: World, id: string): void {
  const m = alive(w).find((x) => x.character.inventory.some((e) => e.id === id)) as Member;
  // Only the first stack of the item gives one up.
  const inv = m.character.inventory;
  const i = inv.findIndex((e) => e.id === id);
  const entry = inv[i] as (typeof inv)[number];
  const rest = entry.quantity > 1 ? [{ ...entry, quantity: entry.quantity - 1 }] : [];
  m.character = { ...m.character, inventory: [...inv.slice(0, i), ...rest, ...inv.slice(i + 1)] };
}

/** Torches the party can still light: kit torches and any bought ones. */
export const spareTorches = (w: World) => w.light.kitTorches + carried(w, 'torch');

/** On coming down, each kit not drawn on since town gives up its torches. */
export function drawKits(w: World): void {
  if (!w.light.kitsReady) return;
  const kits = carried(w, KIT);
  w.light.kitsReady = false;
  if (kits === 0) return;
  w.light.kitTorches += KIT_TORCHES * kits;
  note(w, `The party takes ${KIT_TORCHES * kits} torches from its kits.`);
}

/**
 * Lights the best light to hand: the lantern if the party has one and oil for it, else a torch.
 * Returns false when nothing is left and the party is in the dark.
 */
export function kindle(w: World): boolean {
  const l = w.light;
  if (carried(w, 'lantern') > 0) {
    if (l.lantern === 0 && carried(w, 'oil-one-pint') > 0) {
      takeOne(w, 'oil-one-pint');
      l.lantern = LANTERN_DIE;
      note(w, 'The lantern is filled with oil.');
    }
    if (l.lantern > 0) {
      if (l.lit !== 'lantern') note(w, 'The lantern is lit.');
      l.lit = 'lantern';
      return true;
    }
  }
  if (l.torch === 0 && l.kitTorches > 0) {
    l.kitTorches -= 1;
    l.torch = TORCH_DIE;
  } else if (l.torch === 0 && carried(w, 'torch') > 0) {
    takeOne(w, 'torch');
    l.torch = TORCH_DIE;
  }
  if (l.torch > 0) {
    if (l.lit !== 'torch') note(w, 'A torch is lit.');
    l.lit = 'torch';
    return true;
  }
  if (l.lit !== null || w.dungeon) note(w, 'The party is in the dark.');
  l.lit = null;
  return false;
}

/** The light burns through one turn or one fight; a spent light is replaced if possible. */
export function burn(w: World): void {
  const l = w.light;
  if (!l.lit) return;
  const source = l.lit;
  const { die } = useResource(w.rng, l[source]);
  l[source] = die;
  if (die > 0) return;
  note(w, source === 'torch' ? 'The torch gutters out.' : 'The lantern runs dry.');
  l.lit = null;
  kindle(w);
}

/** Underground with nothing burning, or on a square of magical darkness. */
export const inDark = (w: World, data: GameData) =>
  w.dungeon !== null && (w.light.lit === null || onSpecial(w, data, 'darkness'));

/** Lights go out on reaching the surface; what is left of them keeps. */
export function douse(w: World): void {
  w.light.lit = null;
}
