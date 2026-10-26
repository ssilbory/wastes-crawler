// A headless player for the campaign exit test (Phase 12f): it walks dungeons by their real maps,
// settles every encounter (standing garrisons down with tokens or countersigns, fighting the rest
// with the combat engine), and uses the town's real services.
import type { Facing } from '../../src/data/schemas/index.ts';
import type { GameData } from '../../src/game/character/context.ts';
import { autoLevel } from '../../src/game/character/auto-level.ts';
import { runBattle } from '../../src/game/combat/battle.ts';
import { enterDungeon, step, takeStairs, turnParty } from '../../src/game/dungeon/explore.ts';
import { levelOf } from '../../src/game/dungeon/levels.ts';
import { encounterBattle } from '../../src/game/world/fight.ts';
import {
  authorityFor,
  giveCountersign,
  pendingOrder,
  presentAuthority,
} from '../../src/game/world/orders.ts';
import { settleByFighting, settleByLeaving } from '../../src/game/world/quarter.ts';
import { cureSickness, raiseDead, stayAtInn } from '../../src/game/world/services.ts';
import { enterTown } from '../../src/game/world/town.ts';
import type { World } from '../../src/game/world/types.ts';
import { parseWorld, serializeWorld } from '../../src/game/world/save.ts';
import { createRng } from '../../src/rules/rng.ts';
import { enterRegion } from '../../src/game/world/enter-region.ts';

type Cell = { x: number; y: number };
const SIDES: [Facing, number, number][] = [
  ['n', 0, -1],
  ['e', 1, 0],
  ['s', 0, 1],
  ['w', -1, 0],
];
const ORDER: Facing[] = ['n', 'e', 's', 'w'];

export class Wiped extends Error {}

/** The dead raised, and the healer's cures for poison and disease, paid from a topped-up purse. */
function townCare(w: World, data: GameData): void {
  if (!w.members.some((m) => m.dead || m.poisoned || m.disease)) return;
  w.purse = Math.max(w.purse, 5000);
  for (const m of w.members.filter((x) => x.dead)) raiseDead(w, data, m.id);
  for (const m of w.members) {
    if (m.poisoned) cureSickness(w, data, m.id, 'poison');
    if (m.disease) cureSickness(w, data, m.id, 'disease');
  }
}

/** Settles the pending encounter: stand a garrison down if the party can, else fight. */
export function settle(w: World, data: GameData): void {
  for (let guard = 0; w.encounter && guard < 10; guard++) {
    const order = pendingOrder(w, data);
    if (order && authorityFor(w, data, order.id)) presentAuthority(w, data);
    else if (order && w.countersigns.includes(order.id)) giveCountersign(w, data);
    if (!w.encounter.hostile) {
      settleByLeaving(w, data);
      continue;
    }
    const fight = encounterBattle(w, data);
    const result = runBattle(fight.battle);
    settleByFighting(w, data, fight, result, null);
    if (result.outcome === 'enemy')
      throw new Wiped(`the party fell to ${fight.enemies.flat().join(', ')}`);
  }
}

/** The shortest route on the current level through open edges and doors. */
function route(w: World, data: GameData, to: Cell): Cell[] {
  const s = w.dungeon as NonNullable<World['dungeon']>;
  const { map } = levelOf(data, s.dungeon, s.level);
  const key = (c: Cell) => `${c.x},${c.y}`;
  const prev = new Map<string, Cell | null>([[key(s.at), null]]);
  const queue: Cell[] = [s.at];
  while (queue.length > 0) {
    const c = queue.shift() as Cell;
    if (c.x === to.x && c.y === to.y) break;
    for (const [side, dx, dy] of SIDES) {
      const edge = map.edge(c, side);
      const n = { x: c.x + dx, y: c.y + dy };
      if (edge === 'wall' || edge === 'secret' || prev.has(key(n))) continue;
      prev.set(key(n), c);
      queue.push(n);
    }
  }
  if (!prev.has(key(to))) throw new Error(`no route to ${key(to)} on ${s.level}`);
  const path: Cell[] = [];
  for (let c: Cell | null = to; c && key(c) !== key(s.at); c = prev.get(key(c)) ?? null)
    path.unshift(c);
  return path;
}

function face(w: World, data: GameData, facing: Facing): void {
  const s = w.dungeon as NonNullable<World['dungeon']>;
  const turns = (ORDER.indexOf(facing) - ORDER.indexOf(s.facing) + 4) % 4;
  if (turns === 1) turnParty(w, data, 'right');
  else if (turns === 2) turnParty(w, data, 'around');
  else if (turns === 3) turnParty(w, data, 'left');
}

/** Walks to a cell on the current level, settling whatever it meets on the way. */
export function walkTo(w: World, data: GameData, to: Cell): void {
  for (let tries = 0; tries < 200; tries++) {
    settle(w, data);
    const s = w.dungeon;
    if (!s) throw new Wiped('the party is no longer underground');
    if (s.at.x === to.x && s.at.y === to.y) return;
    const next = route(w, data, to)[0] as Cell;
    const facing = (
      SIDES.find(([, dx, dy]) => s.at.x + dx === next.x && s.at.y + dy === next.y) as [
        Facing,
        number,
        number,
      ]
    )[0];
    face(w, data, facing);
    const r = step(w, data, 'forward', true);
    if (!r.ok && !w.encounter) throw new Error(`can't step toward ${to.x},${to.y}: ${r.reason}`);
  }
  throw new Error(`never reached ${to.x},${to.y}`);
}

/** Walks to stairs and takes them. */
export function stairs(w: World, data: GameData, at: Cell): void {
  walkTo(w, data, at);
  settle(w, data);
  const r = takeStairs(w, data);
  if (!r.ok) throw new Error(`stairs at ${at.x},${at.y}: ${r.reason}`);
  settle(w, data);
}

/** Goes to a hex (the overland road is covered by its own tests) and down its dungeon. */
export function delve(
  w: World,
  data: GameData,
  region: string,
  hex: { col: number; row: number },
): void {
  enterRegion(w, region, hex);
  const r = enterDungeon(w, data);
  if (!r.ok) throw new Error(`can't go down at ${hex.col},${hex.row}: ${r.reason}`);
  settle(w, data);
}

/**
 * Back to a town, a night at the inn, and the party trained to `level`. As a player would, the
 * party first has its dead raised and its poison and disease cured.
 */
export function townRest(
  w: World,
  data: GameData,
  region: string,
  town: { id: string; col: number; row: number },
  level: number,
): void {
  enterRegion(w, region, town);
  enterTown(w, data, town.id);
  settle(w, data);
  w.purse = Math.max(w.purse, 500);
  townCare(w, data);
  stayAtInn(w, data);
  settle(w, data);
  for (const m of w.members) {
    if (m.dead) continue;
    const trained = autoLevel(data, m.character, level, w.rng);
    m.character = { ...trained, strain: { value: 0, broken: false } };
    m.frail = false;
  }
}

/**
 * Runs a delve, and if the party falls, loads the save from before it and tries again, as a player
 * would: a fallen party is lost for good (town.ts, wipe), so there is nothing to raise. The try
 * plays on a fresh random stream, as a player's choices would differ. Returns the tries it took.
 */
export function attempt(
  w: World,
  data: GameData,
  town: { id: string; col: number; row: number },
  run: () => void,
  tries = 3,
  region = 'dark-lands',
): number {
  const before = serializeWorld(w);
  for (let n = 1; ; n++) {
    try {
      run();
      return n;
    } catch (e) {
      if (!(e instanceof Wiped) || n >= tries) throw e;
      const saved = parseWorld(before, data);
      if (!saved.ok) throw new Error(saved.errors.join('; '), { cause: e });
      Object.assign(w, saved.world, { rng: createRng(`${before.length}-retry-${n}`) });
      enterRegion(w, region, town);
      w.purse = Math.max(w.purse, 5000);
      townCare(w, data);
      stayAtInn(w, data);
    }
  }
}
