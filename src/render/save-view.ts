// One line describing a save slot. Pure reads.
import type { GameData } from '../game/character/context.ts';
import { describeDate } from '../game/world/calendar.ts';
import { regionMap, withWorldMap } from '../game/world/region.ts';
import { parseWorld } from '../game/world/save.ts';
import { dungeonOf } from '../game/dungeon/levels.ts';

/** "Morning, 3 Seedtime · Rubblegate · Snag, Grukk", or why the slot can't be continued. */
export function slotSummary(text: string | null, data: GameData): string {
  if (text === null) return 'Empty';
  const loaded = parseWorld(text, data);
  if (!loaded.ok) return 'Damaged save';
  const w = loaded.world;
  const map = regionMap(withWorldMap(data, w.map), w.region);
  const site = map.siteAt(w.position);
  const where = w.dungeon
    ? dungeonOf(data, w.dungeon.dungeon).name
    : (site?.name ?? `the wilds at ${w.position.col},${w.position.row}`);
  // A fallen party leaves no one until a new one is gathered (town.ts, wipe).
  const names = w.members.map((m) => m.character.name).join(', ') || 'no party';
  const name = w.map?.name ?? data.content.realms.find((r) => r.id === w.realm)?.name;
  const world = name ? ` · ${name}` : '';
  return `${describeDate(data.content.overlandRules, w.day, w.quarter)}${world} · ${where} · ${names}`;
}
