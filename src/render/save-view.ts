// One line describing a save slot. Pure reads.
import { dungeonOf } from '../game/dungeon/explore.ts';
import type { GameData } from '../game/character/context.ts';
import { describeDate } from '../game/world/calendar.ts';
import { regionMap } from '../game/world/region.ts';
import { parseWorld } from '../game/world/save.ts';

/** "Morning, 3 Seedtime · Rubblegate · Snag, Grukk", or why the slot can't be continued. */
export function slotSummary(text: string | null, data: GameData): string {
  if (text === null) return 'Empty';
  const loaded = parseWorld(text, data);
  if (!loaded.ok) return 'Damaged save';
  const w = loaded.world;
  const map = regionMap(data, w.region);
  const site = map.siteAt(w.position);
  const where = w.dungeon
    ? dungeonOf(data, w.dungeon.dungeon).name
    : (site?.name ?? `the wilds at ${w.position.col},${w.position.row}`);
  const names = w.members.map((m) => m.character.name).join(', ');
  return `${describeDate(data.content.overlandRules, w.day, w.quarter)} · ${where} · ${names}`;
}
