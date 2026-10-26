// The party's map of each dungeon, kept between visits (Sam's call, docs/rules-adaptation.md,
// Dungeon exploration: Charts): the cells seen, secret doors found and looked over, traps known,
// and magic sensed. Only knowledge is kept; passages dug close and traps disarmed are set again,
// as the dungeon itself resets when the party leaves. A chart is dropped when its dungeon's layout
// has changed: a ruin that has shifted, or a level remade in the editor.
import type { Dungeon } from '../../data/schemas/index.ts';
import type { GameData } from '../character/context.ts';
import type { World } from '../world/types.ts';
import { dungeonOf } from './levels.ts';

/** A short fingerprint of a dungeon's levels, FNV-1a over their maps. */
export function layoutOf(d: Dungeon): string {
  let h = 0x811c9dc5;
  for (const ch of JSON.stringify(d.levels.map((l) => [l.id, l.map]))) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h.toString(16).padStart(8, '0');
}

/** Keeps what the party knows of the dungeon it is in, as it leaves. */
export function chartDungeon(w: World, data: GameData): void {
  const s = w.dungeon;
  if (!s) return;
  const traps = Object.fromEntries(
    Object.entries(s.traps).map(([level, cells]) => [
      level,
      // The party remembers where a trap lies, not that it was disarmed: it is set again.
      Object.fromEntries(Object.keys(cells).map((key) => [key, 'noticed' as const])),
    ]),
  );
  // Copies, so nothing done underground later reaches the chart (or a save) through a shared object.
  w.charted[s.dungeon] = {
    layout: layoutOf(dungeonOf(data, s.dungeon)),
    seen: structuredClone(s.seen),
    found: structuredClone(s.found),
    glimpsed: structuredClone(s.glimpsed),
    traps,
    sensed: structuredClone(s.sensed),
  };
}

/** What the party knows of a dungeon on going down into it, or nothing if its layout changed. */
export function recall(w: World, d: Dungeon) {
  const chart = w.charted[d.id];
  const known = chart && chart.layout === layoutOf(d) ? chart : null;
  // Copies: a trap disarmed this visit must not mark the chart, whose traps are only ever noticed.
  return structuredClone({
    seen: known?.seen ?? {},
    found: known?.found ?? {},
    glimpsed: known?.glimpsed ?? {},
    traps: known?.traps ?? {},
    sensed: known?.sensed ?? {},
  });
}
