// Moving the party between regions (docs/rules-adaptation.md, Regions in Phase 12): each region
// keeps its own explored hexes, swapped in as the party arrives. The road itself is crossing.ts; a
// fallen party's return to its last town (town.ts) moves it the same way.
import { hexKey } from '../../rules/hex.ts';
import type { World } from './types.ts';

/** Moves the party into another region, its explored hexes swapped in. */
export function enterRegion(w: World, regionId: string, at: { col: number; row: number }): void {
  if (regionId !== w.region) {
    w.elsewhere[w.region] = [...w.visited];
    w.visited = new Set(w.elsewhere[regionId] ?? []);
    w.elsewhere = Object.fromEntries(Object.entries(w.elsewhere).filter(([r]) => r !== regionId));
    w.region = regionId;
  }
  w.position = { col: at.col, row: at.row };
  w.destination = null;
  w.visited.add(hexKey(w.position));
}
