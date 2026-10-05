// Groves of walking trees (Sam's calls; docs/rules-adaptation.md, Groves): fixed sites on the
// overland map, marked once their hex is known. Route planning steers around them unless the party
// is headed there; stepping in meets the trees, wary, and a won fight clears the grove for good,
// recorded with the beaten garrison posts.
import type { Grove } from '../../data/schemas/index.ts';
import { hexKey, type Hex } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import type { WorldEvent } from './bus.ts';
import { startEncounter } from './encounters.ts';
import { note } from './members.ts';
import type { World } from './types.ts';

export const groveKey = (g: Grove) => `grove:${g.id}`;

/** The groves of the party's region it hasn't cleared. */
export const grovesHere = (w: World, data: GameData): Grove[] =>
  data.content.groves.filter((g) => g.region === w.region && !w.beaten.includes(groveKey(g)));

/** The hexes a route should go around: every uncleared grove but the one it heads for. */
export function hexesToAvoid(
  w: World,
  data: GameData,
  to: Hex | null = w.destination,
): Set<string> {
  const goal = to && hexKey(to);
  return new Set(
    grovesHere(w, data)
      .map(hexKey)
      .filter((k) => k !== goal),
  );
}

const groveAt = (w: World, data: GameData, h: Hex) =>
  grovesHere(w, data).find((g) => hexKey(g) === hexKey(h));

export function grovesListener(w: World, data: GameData, e: WorldEvent): void {
  if (e.kind !== 'hex-entered' || w.encounter || w.dungeon) return;
  const g = groveAt(w, data, w.position);
  if (!g) return;
  note(w, g.text);
  const met = startEncounter(
    w,
    data,
    { rows: g.enemies, nature: 'wary', captive: null },
    undefined,
    null,
    g.name,
  );
  met.garrison = groveKey(g);
}
