import { describe, expect, it } from 'vitest';
import { rollPatrol } from '../../../src/game/factions/patrols.ts';
import { assault } from '../../../src/game/factions/assault.ts';
import { beginSiege } from '../../../src/game/factions/siege.ts';
import { startFactions } from '../../../src/game/factions/state.ts';
import { sack } from '../../../src/game/factions/strikes.ts';
import { coachRoute, routesFrom } from '../../../src/game/world/coach.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { progressOf } from '../../../src/game/world/major-projects.ts';
import {
  coachRoutes,
  forageBonus,
  patrolsLeft,
  titheSpoils,
  wallsHold,
  watered,
} from '../../../src/game/world/project-effects.ts';
import type { World } from '../../../src/game/world/types.ts';
import { spoils } from '../../../src/game/world/warlords.ts';
import { waterHere } from '../../../src/game/world/water.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, world } from './helpers.ts';

/** A campaign world on a map, standing on a hex. */
function on(region: string, col: number, row: number): World {
  const w = world();
  enterRegion(w, region, { col, row });
  w.position = { col, row };
  startFactions(w, data);
  return w;
}

const finish = (w: World, id: string, shutUntil: number | null = null) => {
  w.majorProjects[id] = { ...progressOf(w, id), done: 0, shutUntil };
};

describe('walls (docs/rules-adaptation.md, Major projects: Project kinds)', () => {
  it('turn half of a settlement’s raids back, while the effect is not shut', () => {
    const w = on('dark-lands', 10, 4);
    expect(wallsHold(w, data, 'lanternfall')).toBe(0);
    finish(w, 'wall-lanternfall');
    expect(wallsHold(w, data, 'lanternfall')).toBe(50);
    expect(wallsHold(w, data, 'mirewatch')).toBe(0);
    finish(w, 'wall-lanternfall', w.day + 5);
    expect(wallsHold(w, data, 'lanternfall')).toBe(0);
    finish(w, 'wall-lanternfall', w.day);
    expect(wallsHold(w, data, 'lanternfall')).toBe(50);
  });

  it('turn a siege’s assault back, or let it through', () => {
    const w = on('dark-lands', 10, 4);
    finish(w, 'wall-lanternfall');
    const s = beginSiege(w, data, 'bastion', 'lanternfall', 'settlements');
    w.rng = scriptedRng([30]);
    expect(assault(w, data, s, null)).toEqual({ held: true, turned: true });
    expect(w.log.at(-1)).toContain(
      "the walls of Lanternfall turned The Dawnwall Bastion's assault back",
    );
    // Past the walls, the assault goes on; with no besiegers there, nothing is fought.
    const lines = w.log.length;
    w.rng = scriptedRng([80]);
    expect(assault(w, data, s, null)).toEqual({ held: true, turned: false });
    expect(w.log.length).toBe(lines);
  });

  it('halve how long a sacking keeps prices up', () => {
    const w = on('dark-lands', 10, 4);
    sack(w, data, 'mirewatch');
    expect(w.raided.mirewatch).toBe(w.day + 1 + 30);
    expect(w.log.at(-1)).toContain('Prices there are up for a month.');
    finish(w, 'wall-lanternfall');
    sack(w, data, 'lanternfall');
    expect(w.raided.lanternfall).toBe(w.day + 1 + 15);
    expect(w.log.at(-1)).toContain('Prices there are up for half a month.');
  });
});

describe('roads and coaches', () => {
  it('ambush less and cost less once secured', () => {
    const w = on('borderlands', 3, 8);
    expect(coachRoute(w, data, 'west-road')).toMatchObject({ fare: 15, ambushDie: 6 });
    finish(w, 'secure-west-road');
    expect(coachRoute(w, data, 'west-road')).toMatchObject({ fare: 10, ambushDie: 10 });
    expect(coachRoute(w, data, 'ash-road')).toMatchObject({ fare: 20, ambushDie: 4 });
  });

  it('run new routes once opened', () => {
    const w = on('pale-reach', 10, 12);
    expect(routesFrom(w, data, 'saltwick')).toEqual([]);
    finish(w, 'saltwick-coach');
    expect(routesFrom(w, data, 'saltwick').map((r) => r.to.name)).toEqual(['Thornwatch']);
    expect(coachRoutes(w, data).find((r) => r.id === 'saltwick-coach')).toEqual({
      id: 'saltwick-coach',
      towns: ['saltwick', 'thornwatch'],
      fare: 10,
      ambushDie: 6,
    });
  });
});

describe('an ended tithe', () => {
  it('raises what the villages on its map pay', () => {
    const w = on('dark-lands', 10, 4);
    finish(w, 'end-grisks-tithe');
    expect(titheSpoils(w, data)).toBe(20);
    expect(spoils(w, data)).toBe(20);
    // A town pays as before, and so does another map.
    w.position = { col: 6, row: 12 };
    expect(spoils(w, data)).toBe(0);
    const b = on('borderlands', 17, 4);
    finish(b, 'end-grisks-tithe');
    expect(titheSpoils(b, data)).toBe(0);
    expect(spoils(b, data)).toBe(0);
    w.position = { col: 10, row: 4 };
    w.dungeon = {} as World['dungeon'];
    expect(spoils(w, data)).toBe(0);
  });

  it('thins the faction’s patrols on that map', () => {
    const w = on('dark-lands', 12, 4);
    expect(patrolsLeft(w, data, 'warhost')).toBe(100);
    finish(w, 'end-grisks-tithe');
    expect(patrolsLeft(w, data, 'warhost')).toBe(50);
    expect(patrolsLeft(w, data, 'bastion')).toBe(100);
    const host = w.factions.warhost;
    if (!host) throw new Error('no Warhost');
    for (const a of host.assets) a.at = 'lanternfall';
    // The patrol comes (1 on the d2), is picked (1 of the patrols near), then rides one time in 2.
    w.rng = scriptedRng([1, 1, 51]);
    expect(rollPatrol(w, data)).toBeNull();
    w.rng = scriptedRng([1, 1, 50]);
    expect(rollPatrol(w, data)?.key.startsWith('warhost:')).toBe(true);
  });
});

describe('restored land', () => {
  it('eases foraging within its reach', () => {
    const w = on('dark-lands', 13, 20);
    expect(forageBonus(w, data)).toBe(0);
    finish(w, 'mirewatch-drains');
    expect(forageBonus(w, data)).toBe(1);
    w.position = { col: 13, row: 23 };
    expect(forageBonus(w, data)).toBe(1);
    w.position = { col: 13, row: 24 };
    expect(forageBonus(w, data)).toBe(0);
    w.position = { col: 13, row: 20 };
    w.dungeon = {} as World['dungeon'];
    expect(forageBonus(w, data)).toBe(0);
  });

  it('waters the hexes around it, which aren’t dry land', () => {
    const w = on('dark-lands', 8, 12);
    expect(watered(w, data)).toBe(false);
    finish(w, 'cinderhold-cisterns');
    expect(watered(w, data)).toBe(true);
    w.water = 4;
    w.dryDay = false;
    waterHere(w, data);
    expect(w.water).toBe(12);
    expect(w.dryDay).toBe(false);
    const far = on('borderlands', 3, 8);
    finish(far, 'cinderhold-cisterns');
    expect(watered(far, data)).toBe(false);
  });
});
