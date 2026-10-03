// Walking a dungeon (docs/plan.md, Map format; docs/rules-adaptation.md, Dungeons in Phase 7 and
// Dungeon exploration): step and turn on the grid, walk through doors, take stairs between levels
// or back to the hex map. Steps count toward exploration turns (time.ts); each flight of stairs
// costs a quarter day. Secret doors are walls until Phase 8's Search.
import { parseLevelMap, type LevelMap } from '../../data/dungeon-map.ts';
import type { Dungeon, DungeonLevel, DungeonState } from '../../data/schemas/index.ts';
import { ahead, cellKey, turn, type Cell, type Facing } from '../../rules/grid.ts';
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { note } from '../world/members.ts';
import { endQuarter } from '../world/quarter.ts';
import { douse, drawKits, inDark, kindle } from './light.ts';
import { countStep } from './time.ts';
import type { TownResult } from '../world/services.ts';
import type { World } from '../world/types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export function dungeonOf(data: GameData, id: string): Dungeon {
  const d = data.content.dungeons.find((x) => x.id === id);
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

/** The dungeon whose entrance is the party's hex, if any. */
export function dungeonHere(w: World, data: GameData): Dungeon | undefined {
  return data.content.dungeons.find(
    (d) => d.region === w.region && hexKey(d.entrance) === hexKey(w.position),
  );
}

/** Marks the party's cell and the cells it can see straight ahead (up to 3) as seen. */
function look(w: World, data: GameData, s: DungeonState): void {
  // In the dark the party maps nothing (docs/rules-adaptation.md, Dungeon exploration).
  if (inDark(w)) return;
  const { map } = levelOf(data, s.dungeon, s.level);
  const seen = new Set(s.seen[s.level] ?? []);
  let c: Cell = s.at;
  seen.add(cellKey(c));
  for (let i = 0; i < 3 && map.edge(c, s.facing) === 'open'; i++) {
    c = ahead(c, s.facing);
    seen.add(cellKey(c));
  }
  s.seen[s.level] = [...seen];
}

function arrive(w: World, data: GameData, level: string, at: Cell, facing: Facing): void {
  const s = w.dungeon as NonNullable<World['dungeon']>;
  Object.assign(s, { level, at, facing });
  look(w, data, s);
  note(w, `The party reaches ${levelOf(data, s.dungeon, level).level.name}.`);
}

/** Goes down into the dungeon at the party's hex: a quarter day. */
export function enterDungeon(w: World, data: GameData): TownResult {
  const d = dungeonHere(w, data);
  if (!d) return no('There is no way down here.');
  if (w.dungeon) return no('The party is already underground.');
  if (w.encounter) return no('Settle the encounter first.');
  if (w.coach) return no('The party is on a coach.');
  w.destination = null;
  w.dungeon = {
    dungeon: d.id,
    level: d.entry.level,
    at: d.entry.at,
    facing: d.entry.facing,
    seen: {},
    turn: 0,
    steps: 0,
  };
  note(w, `The party goes down into ${d.name}.`);
  drawKits(w);
  kindle(w);
  arrive(w, data, d.entry.level, d.entry.at, d.entry.facing);
  endQuarter(w, data);
  return { ok: true };
}

export type Step = 'forward' | 'back' | 'left' | 'right';

/** One step; doors open as the party walks through, walls and secret doors stop it. */
export function step(w: World, data: GameData, dir: Step): TownResult {
  const s = w.dungeon;
  if (!s) throw new Error('the party is not in a dungeon');
  if (w.encounter) return no('Settle the encounter first.');
  const way =
    dir === 'forward' ? s.facing : dir === 'back' ? turn(s.facing, 'around') : turn(s.facing, dir);
  const { map } = levelOf(data, s.dungeon, s.level);
  const edge = map.edge(s.at, way);
  if (edge === 'wall' || edge === 'secret') return no('A wall blocks the way.');
  s.at = ahead(s.at, way);
  look(w, data, s);
  countStep(w, data);
  return { ok: true };
}

export function turnParty(w: World, data: GameData, by: 'left' | 'right' | 'around'): void {
  const s = w.dungeon;
  if (!s) throw new Error('the party is not in a dungeon');
  s.facing = turn(s.facing, by);
  look(w, data, s);
}

/** The stairs link at the party's cell, if it stands on stairs. */
export function stairsHere(w: World, data: GameData) {
  const s = w.dungeon;
  if (!s) return undefined;
  return levelOf(data, s.dungeon, s.level).level.links.find(
    (l) => l.at.x === s.at.x && l.at.y === s.at.y,
  );
}

/** Takes the stairs: to the linked level, or out to the hex map. A quarter day either way. */
export function takeStairs(w: World, data: GameData): TownResult {
  const link = stairsHere(w, data);
  if (!link) return no('There are no stairs here.');
  if (w.encounter) return no('Settle the encounter first.');
  const s = w.dungeon as NonNullable<World['dungeon']>;
  if ('surface' in link.to) {
    note(w, `The party climbs out of ${dungeonOf(data, s.dungeon).name}.`);
    w.dungeon = null;
    douse(w);
  } else arrive(w, data, link.to.level, link.to.at, link.to.facing);
  endQuarter(w, data);
  return { ok: true };
}
