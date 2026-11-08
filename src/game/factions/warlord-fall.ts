// A Wastes warlord's fall breaks their faction (docs/rules-adaptation.md, The Wastes: Factions;
// Sam's calls). Winning the warlord's hoard (src/game/world/warlords.ts) scatters their faction:
// its sieges end, its assets and bases are gone (vendor/wwn-srd/6.0 Factions/Faction
// Statistics.md, a faction at zero hit points), and every village it held goes back to its ally.
import type { GameData } from '../character/context.ts';
import { warlordOfHoard } from '../world/warlords.ts';
import type { World } from '../world/types.ts';
import { reclaimAll } from './capture.ts';
import { factionOf, isActive, news } from './state.ts';

/** Breaks a faction at once: its sieges, on either side, end, and it holds nothing. */
export function breakFaction(w: World, data: GameData, id: string): void {
  const s = w.factions[id];
  if (!isActive(s)) return;
  w.sieges = w.sieges.filter((x) => x.attacker !== id && x.defender !== id);
  s.assets = [];
  s.bases = [];
  s.hp = 0;
  news(w, `${factionOf(data, id).name} breaks apart.`);
  reclaimAll(w, data);
}

/** A won hoard whose boss is a warlord with a faction breaks it. Returns whether it did. */
export function warlordFalls(w: World, data: GameData, hoard: string): boolean {
  const faction = warlordOfHoard(data, hoard)?.faction;
  if (!faction || !isActive(w.factions[faction])) return false;
  breakFaction(w, data, faction);
  return true;
}
