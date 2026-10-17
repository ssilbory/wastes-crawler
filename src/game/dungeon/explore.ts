// Walking a dungeon (docs/plan.md, Map format; docs/rules-adaptation.md, Dungeons in Phase 7 and
// Dungeon exploration): step and turn on the grid, walk through doors, take stairs between levels
// or back to the hex map. Steps count toward exploration turns (time.ts); each flight of stairs
// costs a quarter day. Secret doors are walls until Phase 8's Search.
import { parseLevelMap, type LevelMap } from '../../data/dungeon-map.ts';
import type { Dungeon, DungeonLevel, DungeonState, Ruin } from '../../data/schemas/index.ts';
import { ahead, cellKey, turn, type Cell, type Facing } from '../../rules/grid.ts';
import { hexKey } from '../../rules/hex.ts';
import type { GameData } from '../character/context.ts';
import { note } from '../world/members.ts';
import { endQuarter } from '../world/quarter.ts';
import { emit } from '../world/bus.ts';
import { ruinDungeon } from './generate.ts';
import { openRuin, ruinHere } from './ruins.ts';
import { chartDungeon, recall } from './chart.ts';
import { douse, drawKits, blind, kindle } from './light.ts';
import { glimpse, knownEdges } from './secrets.ts';
import { arriveOn, onSpecial } from './specials.ts';
import { countStep } from './time.ts';
import { approach, springHere } from './traps.ts';
import type { TownResult } from '../world/services.ts';
import type { World } from '../world/types.ts';

const no = (reason: string): TownResult => ({ ok: false, reason });

export function dungeonOf(data: GameData, id: string): Dungeon {
  const d = data.content.dungeons.find((x) => x.id === id) ?? ruinDungeon(data.content.ruins, id);
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

/** Marks the party's cell and the cells it can see straight ahead (up to 3) as seen. */
export function look(w: World, data: GameData, s: DungeonState): void {
  // In the dark, or on an anti-map square, the party maps nothing (docs/rules-adaptation.md,
  // Dungeon exploration).
  if (blind(w, data) || onSpecial(w, data, 'anti-map')) return;
  const edge = knownEdges(w, data);
  const seen = new Set(s.seen[s.level] ?? []);
  let c: Cell = s.at;
  seen.add(cellKey(c));
  for (let i = 0; i < 3 && edge(c, s.facing) === 'open'; i++) {
    c = ahead(c, s.facing);
    seen.add(cellKey(c));
  }
  s.seen[s.level] = [...seen];
}

/**
 * The way to face on arriving: as the content says, unless that faces a wall, then the first way
 * that doesn't, turning right, left, then around (Borderlands polish, Phase 16).
 */
export function openFacing(map: LevelMap, at: Cell, facing: Facing): Facing {
  const ways = [facing, turn(facing, 'right'), turn(facing, 'left'), turn(facing, 'around')];
  const passable = (f: Facing) => map.edge(at, f) === 'open' || map.edge(at, f) === 'door';
  return ways.find(passable) ?? facing;
}

/** Towers and cities are walked into and out of; delves are climbed down into and out of. */
export function goesDown(data: GameData, dungeonId: string): boolean {
  const ruin = data.content.ruins.find((r) => dungeonId.startsWith(`${r.id}-v`));
  return ruin === undefined || ruin.kind === 'delve';
}

/** The button for the way out to the hex map. */
export const exitLabel = (data: GameData, dungeonId: string) =>
  `${goesDown(data, dungeonId) ? 'Climb out of' : 'Leave'} ${dungeonOf(data, dungeonId).name}`;

/** Lands the party on a level, with the landing square's own effects as a step onto it has. */
function arrive(w: World, data: GameData, level: string, at: Cell, facing: Facing): void {
  const s = w.dungeon as NonNullable<World['dungeon']>;
  const { map } = levelOf(data, s.dungeon, level);
  Object.assign(s, { level, at, facing: openFacing(map, at, facing) });
  note(w, `The party reaches ${levelOf(data, s.dungeon, level).level.name}.`);
  arriveOn(w, data);
  look(w, data, s);
  glimpse(w, data);
  springHere(w, data);
  emit(w, data, { kind: 'level-entered' });
  emit(w, data, { kind: 'cell-entered' });
}

/** Goes down into the dungeon at the party's hex: a quarter day. */
export function enterDungeon(w: World, data: GameData): TownResult {
  const ruin = ruinHere(w, data);
  if (!dungeonHere(w, data) && !ruin) return no('There is no way down here.');
  if (w.dungeon) return no('The party is already underground.');
  if (w.encounter) return no('Settle the encounter first.');
  if (w.coach) return no('The party is on a coach.');
  const d = dungeonHere(w, data) ?? openRuin(w, data, ruin as Ruin);
  w.destination = null;
  // The party's map from its last visit, if the layout still matches (Charts).
  const known = recall(w, d);
  w.dungeon = {
    dungeon: d.id,
    level: d.entry.level,
    at: d.entry.at,
    facing: d.entry.facing,
    seen: known.seen,
    turn: 0,
    steps: 0,
    found: known.found,
    dug: {},
    glimpsed: known.glimpsed,
    traps: known.traps,
    read: {},
    sight: null,
    sensed: known.sensed,
  };
  note(w, `The party ${goesDown(data, d.id) ? 'goes down into' : 'enters'} ${d.name}.`);
  drawKits(w);
  kindle(w);
  arrive(w, data, d.entry.level, d.entry.at, d.entry.facing);
  endQuarter(w, data);
  return { ok: true };
}

export type Step = 'forward' | 'back' | 'left' | 'right';

/**
 * One step; doors open as the party walks through, and walls and unfound secret doors stop it. A
 * trap ahead may be spotted and stop the party, unless it means to step in (traps.ts).
 */
export function step(w: World, data: GameData, dir: Step, stepIn = false): TownResult {
  const s = w.dungeon;
  if (!s) throw new Error('the party is not in a dungeon');
  if (w.encounter) return no('Settle the encounter first.');
  const way =
    dir === 'forward' ? s.facing : dir === 'back' ? turn(s.facing, 'around') : turn(s.facing, dir);
  const edge = knownEdges(w, data)(s.at, way);
  if (edge === 'wall' || edge === 'secret') return no('A wall blocks the way.');
  const target = ahead(s.at, way);
  const stop = approach(w, data, target, stepIn);
  if (stop) return no(stop);
  const from = s.level;
  s.at = target;
  arriveOn(w, data);
  look(w, data, s);
  glimpse(w, data);
  springHere(w, data);
  if (s.level !== from) emit(w, data, { kind: 'level-entered' });
  emit(w, data, { kind: 'cell-entered' });
  countStep(w, data);
  return { ok: true };
}

export function turnParty(w: World, data: GameData, by: 'left' | 'right' | 'around'): TownResult {
  const s = w.dungeon;
  if (!s) throw new Error('the party is not in a dungeon');
  if (w.encounter) return no('Settle the encounter first.');
  s.facing = turn(s.facing, by);
  look(w, data, s);
  return { ok: true };
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
    const name = dungeonOf(data, s.dungeon).name;
    note(w, `The party ${goesDown(data, s.dungeon) ? 'climbs out of' : 'leaves'} ${name}.`);
    chartDungeon(w, data);
    w.dungeon = null;
    douse(w);
  } else arrive(w, data, link.to.level, link.to.at, link.to.facing);
  endQuarter(w, data);
  return { ok: true };
}
