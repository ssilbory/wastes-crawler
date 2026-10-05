import { describe, expect, it } from 'vitest';
import { pickGoal } from '../../../src/game/factions/goals.ts';
import { factionTurn, takeAction } from '../../../src/game/factions/turn.ts';
import { emit } from '../../../src/game/world/bus.ts';
import type { Rng } from '../../../src/rules/rng.ts';
import { data, faction, factionWorld, held } from './helpers.ts';

/** Every die rolls its highest face: initiative goes in content order, and checks to the higher rating. */
const highRolls: Rng = {
  int: (_min, max) => max,
  next: () => 0.99,
  state: () => [0, 0, 0, 0],
};
const none = () => undefined;

describe('a faction action (6.6.0)', () => {
  it('sits out a turn after giving up a goal, and repairs when badly hurt', () => {
    const w = factionWorld();
    w.rng = highRolls;
    pickGoal(w, data, 'warhost', 0);
    const s = faction(w, 'warhost');
    s.idle = true;
    expect(takeAction(w, data, 'warhost', none)).toBe(false);
    expect(s.idle).toBe(false);
    s.hp = 10;
    s.treasure = 1;
    takeAction(w, data, 'warhost', none);
    expect(s.hp).toBe(14);
    // An asset at half its hit points counts too.
    s.hp = 20;
    held(w, 'warhost', 'infantry').hp = 3;
    s.treasure = 1;
    takeAction(w, data, 'warhost', none);
    expect(held(w, 'warhost', 'infantry').hp).toBe(6);
  });

  it("keeps the peace by building where it is weakest, or patching up when it can't build", () => {
    const w = factionWorld();
    w.rng = highRolls;
    const s = faction(w, 'settlements');
    pickGoal(w, data, 'settlements', 0);
    s.treasure = 4;
    expect(takeAction(w, data, 'settlements', none)).toBe(false);
    expect(s.assets).toHaveLength(5);
    held(w, 'settlements', 'local-guard').hp = 3;
    s.treasure = 0;
    takeAction(w, data, 'settlements', none);
    expect(s.assets).toHaveLength(5);
    held(w, 'settlements', 'local-guard').hp = 4;
    takeAction(w, data, 'settlements', none);
    expect(s.assets).toHaveLength(5);
  });

  it('attacks where it can, builds while short or flush, and otherwise marches', () => {
    const w = factionWorld();
    w.rng = highRolls;
    const s = faction(w, 'warhost');
    pickGoal(w, data, 'warhost', 0);
    held(w, 'warhost', 'infantry').at = 'cinderhold';
    const struck: string[] = [];
    expect(takeAction(w, data, 'warhost', (v) => struck.push(v))).toBe(true);
    expect(struck).toEqual(['settlements']);
    // Short of fighters: build one.
    s.assets = [];
    s.treasure = 6;
    takeAction(w, data, 'warhost', none);
    expect(s.assets.map((a) => a.asset)).toEqual(['infantry']);
    // Flush: build again.
    s.treasure = 10;
    takeAction(w, data, 'warhost', none);
    expect(s.assets).toHaveLength(2);
    // Two fighters, little Treasure: march on the weakest rival base.
    s.treasure = 0;
    takeAction(w, data, 'warhost', none);
    expect(s.assets.map((a) => a.at)).toEqual(['lanternfall', 'lanternfall']);
  });

  it('waits with nobody to march on, or nothing to march with', () => {
    const w = factionWorld();
    w.rng = highRolls;
    const s = faction(w, 'warhost');
    pickGoal(w, data, 'warhost', 0);
    s.treasure = 0;
    faction(w, 'settlements').hp = 0;
    faction(w, 'bastion').hp = 0;
    takeAction(w, data, 'warhost', none);
    expect(s.assets.every((a) => a.at === 'grisks-hold')).toBe(true);
    faction(w, 'settlements').hp = 17;
    s.assets = [];
    takeAction(w, data, 'warhost', none);
    expect(s.assets).toEqual([]);
  });
});

describe('the faction turn (6.2.0)', () => {
  it('runs as each month begins, starting factions an older save lacks', () => {
    const w = factionWorld();
    w.factions = {};
    w.day = 28;
    emit(w, data, { kind: 'day-passed' });
    expect(w.factions).toEqual({});
    w.day = 29;
    emit(w, data, { kind: 'day-passed' });
    expect(Object.keys(w.factions)).toEqual(['warhost', 'settlements', 'bastion', 'loyalists']);
    expect(faction(w, 'warhost').goal?.kind).toBe('blood-the-enemy');
  });

  it('earns Treasure, and the clock moves when the warhost takes a base or meets a goal', () => {
    const w = factionWorld();
    w.rng = highRolls;
    faction(w, 'loyalists').hp = 0;
    const s = faction(w, 'warhost');
    pickGoal(w, data, 'warhost', 1);
    expect(s.goal?.target).toEqual({ faction: 'settlements', at: 'lanternfall' });
    held(w, 'warhost', 'infantry').at = 'lanternfall';
    faction(w, 'settlements').assets = faction(w, 'settlements').assets.filter(
      (a) => a.at !== 'lanternfall',
    );
    factionTurn(w, data);
    // Income 4 plus 2 from the breeding pens (a 6), on top of the 4 it had.
    expect(s.treasure).toBe(10);
    expect(w.clock).toBe(2);
    expect(w.log.join('\n')).toContain("Grisk's Warhost takes Lanternfall.");
    expect(w.log.join('\n')).toContain("Grisk's Warhost grows stronger.");
    // A goal another faction meets leaves the clock alone; Blood counts damage dealt.
    pickGoal(w, data, 'warhost', 0);
    held(w, 'warhost', 'infantry').at = 'mirewatch';
    faction(w, 'settlements').assets = [];
    for (const x of faction(w, 'settlements').bases) if (x.at === 'mirewatch') x.hp = 20;
    factionTurn(w, data);
    expect(s.goal?.progress).toBe(8);
  });
});
