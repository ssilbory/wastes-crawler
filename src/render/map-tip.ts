// What the overland map's tooltip says about a hex (Sam's asks): shown on hover with a mouse, on a
// long press on a phone, and on keyboard focus. It names the place first: a town, a dungeon, where
// a quest leads, a grove, a lair, a camp, or a road off the map, with any others there beneath it.
// Only a hex with none of those is named for its terrain, and one under fog is unexplored.
import type { HexCell } from './hex-view.ts';

export interface HexTip {
  title: string;
  lines: string[];
}

/** Where a quest leads, by the quest's name when the map knows it. */
const questLine = (c: HexCell): string | null =>
  c.questName ? `Quest: ${c.questName}` : c.quest ? 'A quest leads here' : null;

export function hexTip(c: HexCell): HexTip {
  const places = [c.site, c.dungeon, questLine(c), c.grove, c.lair, c.camp, c.exit].filter(
    (x): x is string => x !== null,
  );
  const [first, ...rest] = places;
  return {
    title: first ?? c.terrainName ?? 'Unexplored',
    lines: [
      ...rest,
      ...(c.party ? ['The party is here'] : []),
      ...(c.destination ? ['Your destination'] : []),
    ],
  };
}
