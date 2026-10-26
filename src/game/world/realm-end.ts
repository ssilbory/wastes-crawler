// A realm's ending (docs/rules-adaptation.md, Shipped worlds: the Sealed Vale ends when the party
// clears the pass). Reaching the
// realm's ending hex with no fight pending marks it reached; the world screen shows the ending
// once, and the party can go back to the title screen or keep adventuring.
import type { Realm } from '../../data/schemas/index.ts';
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { note } from './members.ts';
import type { World } from './types.ts';

type Ending = NonNullable<Realm['ending']>;

/** The ending of the realm the world is played on, if it has one. */
export function realmEnding(w: World, data: GameData): Ending | null {
  return data.content.realms.find((r) => r.id === w.realm)?.ending ?? null;
}

/** Marks the ending reached when the party stands on its hex, free of any encounter. */
export function checkRealmEnd(w: World, data: GameData): void {
  const end = realmEnding(w, data);
  if (!end || w.realmEnd || w.encounter || w.dungeon) return;
  if (w.region !== end.region || hexKey(w.position) !== hexKey(end)) return;
  w.realmEnd = 'reached';
  note(w, end.title);
}

/** The ending is shown once: after that the party keeps adventuring, or goes back to the title. */
export function seeRealmEnd(w: World): void {
  if (w.realmEnd === 'reached') w.realmEnd = 'seen';
}

/** The bus listener: arriving on the hex, or winning the fight that held it. */
export function realmEndListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind === 'hex-entered' || e.kind === 'fight-won') checkRealmEnd(w, data);
}
