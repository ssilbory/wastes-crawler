// The end of a quarter day (docs/rules-adaptation.md, Overland travel): Tireless Vigor and the
// Vowed's vigor tick, and after the fourth quarter the day ends (day.ts). Kept apart from playing a
// quarter (quarter.ts), so the dungeon, the road, and the stairs can pass time without it.
import type { GameData } from '../character/context.ts';
import { VIGOR_QUARTER, vigor } from './arts.ts';
import { endOfDay } from './day.ts';
import type { World } from './types.ts';
import { MASTERS_VIGOR_QUARTER, mastersVigor } from './vowed-arts.ts';

export function endQuarter(w: World, data: GameData): void {
  vigor(w, data, VIGOR_QUARTER);
  mastersVigor(w, data, MASTERS_VIGOR_QUARTER);
  // A spell read from a scroll and not cast is lost with the quarter (Phase 21).
  for (const m of w.members) m.unrolled = null;
  if (w.quarter < 3) {
    w.quarter += 1;
    return;
  }
  if (endOfDay(w, data)) return;
  w.day += 1;
  w.quarter = 0;
}
