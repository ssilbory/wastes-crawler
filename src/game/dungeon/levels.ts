// Where the party is underground (docs/plan.md, Map format): a dungeon by id, hand-made or a ruin's
// generated one, and a level with its parsed map. The lookups explore.ts and every dungeon feature
// share, kept apart from walking so features can read the map without importing the walk.
import { parseLevelMap, type LevelMap } from '../../data/dungeon-map.ts';
import type { Dungeon, DungeonLevel } from '../../data/schemas/index.ts';
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import type { World } from '../world/types.ts';
import { ruinDungeon } from './generate.ts';
import { ruinOfDungeon } from './hidden-ruins.ts';

export function dungeonOf(data: GameData, id: string): Dungeon {
  const ruin = data.content.dungeons.some((x) => x.id === id) ? undefined : ruinOfDungeon(data, id);
  const d =
    data.content.dungeons.find((x) => x.id === id) ??
    (ruin && ruinDungeon([ruin], data.content.ruinTraps, id));
  if (!d) throw new Error(`unknown dungeon ${id}`);
  return d;
}

const maps = new WeakMap<DungeonLevel, LevelMap>();

/** A level and its parsed map; content checks guarantee the map parses. */
export function levelOf(data: GameData, dungeonId: string, levelId: string) {
  const level = dungeonOf(data, dungeonId).levels.find((l) => l.id === levelId);
  if (!level) throw new Error(`unknown level ${levelId}`);
  let map = maps.get(level);
  if (!map) {
    map = (parseLevelMap(level.map) as { ok: true; map: LevelMap }).map;
    maps.set(level, map);
  }
  return { level, map };
}

/** The hand-made dungeon whose entrance is the party's hex, if any; ruins are in ruins.ts. */
export function dungeonHere(w: World, data: GameData): Dungeon | undefined {
  return data.content.dungeons.find(
    (d) => d.region === w.region && hexKey(d.entrance) === hexKey(w.position),
  );
}
