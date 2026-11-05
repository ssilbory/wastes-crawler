// Siege fights scaled to the party (Phase 23h; docs/rules-adaptation.md, Sieges: Harder sieges;
// Sam's call). Every fight the party has in a siege, at the lines, in an assault, or storming a
// held town, gains siegeRules.levelScale fighters per level of the party, rounded down, drawn in
// turn from the group's own monsters, and lined up with it in rows of eight, at most three.
import type { GameData } from '../character/context.ts';
import { mergeGroups, toRows } from '../factions/assault.ts';
import { partyLevel } from './difficulty.ts';
import type { World } from './types.ts';

/** How many fighters the party's level adds to a siege fight. */
export const levelExtra = (w: World, data: GameData): number =>
  Math.floor(data.content.siegeRules.levelScale * partyLevel(w, data));

/** A siege fight's rows with the party's level's extra fighters among them. */
export function scaledRows(w: World, data: GameData, rows: string[][]): string[][] {
  const pool = rows.flat();
  const extra = levelExtra(w, data);
  if (extra === 0 || pool.length === 0) return rows;
  const more = Array.from({ length: extra }, (_, i) => pool[i % pool.length] as string);
  return mergeGroups([rows, toRows(more)]);
}
