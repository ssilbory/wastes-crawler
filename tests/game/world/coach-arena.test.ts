import { describe, expect, it } from 'vitest';
import { arenaCard, boutBlocked, settleBout, startBout } from '../../../src/game/world/arena.ts';
import {
  boardCoach,
  coachQuarter,
  coachRoute,
  fareListed,
  passengers,
  routesFrom,
} from '../../../src/game/world/coach.ts';
import { addNpc } from '../../../src/game/world/npcs.ts';
import { passQuarter, settleByFighting } from '../../../src/game/world/quarter.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from './helpers.ts';

function westhold(faces?: number[]): World {
  const w = world(faces);
  w.purse = 500;
  return w;
}

/** Passes quarters on the coach, failing any ambush roll. */
function ride(w: World, quarters: number) {
  for (let i = 0; i < quarters; i++) {
    w.rng = createRng(`ride-${w.day}-${w.quarter}`);
    const ambushRoll = w.rng.int;
    w.rng.int = (min, max) => (max === 6 && min === 1 ? 6 : ambushRoll(min, max));
    coachQuarter(w, data);
  }
}

describe('coach routes (docs/rules-adaptation.md, Coach routes)', () => {
  it('lists the routes from a town and prices a fare per passenger', () => {
    const w = westhold([3]);
    expect(routesFrom(w, data, 'westhold').map((r) => r.to.name)).toEqual(['Scrapmarch']);
    expect(routesFrom(w, data, 'eastmarch').map((r) => r.to.name)).toEqual(['Rubblegate']);
    expect(routesFrom(w, data, 'highcairn')).toEqual([]);
    expect(coachRoute(data, 'west-road').fare).toBe(15);
    expect(() => coachRoute(data, 'sky-road')).toThrow('unknown coach route sky-road');
    member(w, 'Fizzwick').dead = true;
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'Aldo', true);
    expect(passengers(w)).toBe(4);
    expect(fareListed(w, data, 'west-road')).toBe(60);
  });

  it('boards for a fare through the town surcharge, or refuses', () => {
    const w = westhold();
    w.destination = { col: 9, row: 9 };
    expect(boardCoach(w, data, 'west-road')).toEqual({ ok: true });
    expect(w.purse).toBe(440);
    expect(w.coach).toMatchObject({ route: 'west-road', to: 'eastmarch', checkedDay: null });
    expect(w.coach?.path).toHaveLength(17);
    expect(w.destination).toBeNull();
    expect(boardCoach(w, data, 'west-road')).toEqual({
      ok: false,
      reason: 'The party is already on a coach.',
    });
    expect(passQuarter(w, data, { kind: 'camp', activities: {} })).toBe(false);
    const poor = westhold();
    poor.purse = 10;
    expect(boardCoach(poor, data, 'west-road')).toEqual({
      ok: false,
      reason: 'The fare comes to 60 crowns.',
    });
    poor.encounter = encounter([['thug-or-militia']]);
    expect(boardCoach(poor, data, 'west-road')).toMatchObject({ ok: false });
    const highcairn = westhold();
    highcairn.position = { col: 17, row: 4 };
    expect(boardCoach(highcairn, data, 'west-road')).toEqual({
      ok: false,
      reason: 'No coach runs from Grimcairn on that route.',
    });
  });

  it('reports a road with no way through', () => {
    const w = westhold();
    const region = data.content.regions[0] as (typeof data.content.regions)[0];
    const cut = {
      ...data,
      content: {
        ...data.content,
        regions: [{ ...region, overlay: region.overlay.map((r) => r.replace(/=/g, '.')) }],
      },
    };
    expect(boardCoach(w, cut, 'west-road')).toEqual({
      ok: false,
      reason: 'The road to Scrapmarch is cut.',
    });
  });

  it('rolls four hexes a quarter by day and stops at waystations, fed and sheltered, by night', () => {
    const w = westhold();
    boardCoach(w, data, 'west-road');
    const grukk = member(w, 'Grukk');
    grukk.character = { ...grukk.character, hp: { ...grukk.character.hp, current: 2 } };
    w.rations = 4;
    ride(w, 2);
    expect(w).toMatchObject({ position: { col: 11, row: 8 }, quarter: 2 });
    expect(w.visited.has('10,8')).toBe(true);
    ride(w, 1);
    expect(w.log.at(-1)).toContain('The coach stops at a waystation.');
    ride(w, 1);
    expect(w).toMatchObject({ day: 1, quarter: 0, rations: 4 });
    expect(grukk.character.hp.current).toBe(3);
    expect(grukk).toMatchObject({ hungry: false, sleepless: false, cold: false });
    // Seventeen road hexes: arrival on the third morning.
    ride(w, 4);
    expect(w.coach?.path).toHaveLength(1);
    ride(w, 1);
    expect(w.coach).toBeNull();
    expect(w).toMatchObject({ position: { col: 20, row: 8 }, lastTown: 'eastmarch' });
    expect(w.log.join('\n')).toContain('The party reaches Scrapmarch.');
    expect(coachQuarter(w, data)).toBe(false);
  });

  it('is ambushed on 1 in 6 a travel day, out for a fight, and rolls on after a win', () => {
    const w = westhold();
    boardCoach(w, data, 'west-road');
    w.rng = scriptedRng([1, 1, 2, 1, 1]);
    expect(coachQuarter(w, data)).toBe(true);
    expect(w.encounter).toMatchObject({ hostile: true, spotted: false, nature: 'hostile' });
    expect(w.encounter?.text).toContain('Ambush! The coach is set upon at 3,8.');
    expect(coachQuarter(w, data)).toBe(false);
    w.rng = createRng('fight');
    const fight = {
      battle: null as never,
      setup: null as never,
      memberIds: [],
      npcIds: [],
      enemies: [],
      captive: null,
      quest: null,
      garrison: null,
      patrol: null,
    };
    settleByFighting(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: null as never },
      null,
    );
    expect(w.quarter).toBe(1);
    // The day's check is done: the coach rolls on.
    coachQuarter(w, data);
    expect(w.position).toEqual({ col: 7, row: 8 });
  });

  it('is lost when the party falls', () => {
    const w = westhold();
    boardCoach(w, data, 'west-road');
    ride(w, 1);
    w.encounter = encounter([['thug-or-militia']]);
    const fight = {
      battle: null as never,
      setup: null as never,
      memberIds: [],
      npcIds: [],
      enemies: [],
      captive: null,
      quest: null,
      garrison: null,
      patrol: null,
    };
    settleByFighting(
      w,
      data,
      fight,
      { outcome: 'enemy', rounds: 1, deaths: 0, battle: null as never },
      null,
    );
    expect(w.coach).toBeNull();
    expect(w.position).toEqual({ col: 3, row: 8 });
  });
});

describe('town arenas', () => {
  it('lists the town’s card', () => {
    const w = westhold();
    expect(arenaCard(w, data).map((b) => [b.id, b.toTheDeath])).toEqual([
      ['militia-pair', false],
      ['pit-hounds', true],
    ]);
    const nowhere = { ...data, content: { ...data.content, arenaCards: [] } };
    expect(arenaCard(w, nowhere)).toEqual([]);
  });

  it('charges a fee for one bout a day', () => {
    const w = westhold();
    expect(() => startBout(w, data, 'caged-horror')).toThrow('no bout caged-horror here');
    w.purse = 4;
    expect(startBout(w, data, 'militia-pair')).toEqual({
      ok: false,
      reason: 'The fee is 5 crowns.',
    });
    w.purse = 5;
    const bout = startBout(w, data, 'militia-pair');
    if (!bout.ok) throw new Error(bout.reason);
    expect(bout.fight.memberIds).toHaveLength(4);
    expect(bout.fight.npcIds).toEqual([]);
    expect(w).toMatchObject({ purse: 0, arenaDay: 0 });
    expect(boutBlocked(w, data)).toBe('The party has fought its bout for today.');
    expect(startBout(w, data, 'militia-pair')).toEqual({
      ok: false,
      reason: 'The party has fought its bout for today.',
    });
    w.day = 1;
    expect(boutBlocked(w, data)).toBeNull();
    w.encounter = encounter([['thug-or-militia']]);
    expect(boutBlocked(w, data)).toBe('Settle the encounter first.');
    w.encounter = null;
    for (const m of w.members) m.dead = true;
    expect(boutBlocked(w, data)).toBe('No one is fit to fight.');
  });

  it('pulls out the fallen in a bout to yield, and pays the prize for a win', () => {
    const w = westhold();
    const start = startBout(w, data, 'militia-pair');
    if (!start.ok) throw new Error(start.reason);
    const [snag, grukk] = start.fight.battle.combatants;
    Object.assign(snag ?? {}, { status: 'dead', hp: 0 });
    Object.assign(grukk ?? {}, { status: 'dying', hp: 0 });
    const result = { outcome: 'party' as const, rounds: 3, deaths: 1, battle: start.fight.battle };
    settleBout(w, data, start.fight, start.bout, result);
    expect(member(w, 'Snag')).toMatchObject({
      dead: false,
      frail: true,
      character: { hp: { current: 1 } },
    });
    expect(member(w, 'Grukk')).toMatchObject({ dead: false, frail: true });
    expect(w.purse).toBe(510);
    expect(w.log.at(-1)).toContain(
      'The party wins Two militia sparring partners and takes 15 crowns.',
    );
    settleBout(w, data, start.fight, start.bout, { ...result, outcome: 'enemy' });
    expect(w.log.at(-1)).toContain('The party yields.');
  });

  it('lets monsters kill in a bout to the death, dragging out the living', () => {
    const w = westhold();
    const start = startBout(w, data, 'pit-hounds');
    if (!start.ok) throw new Error(start.reason);
    const [snag, grukk] = start.fight.battle.combatants;
    Object.assign(snag ?? {}, { status: 'dead', hp: 0 });
    Object.assign(grukk ?? {}, { status: 'dying', hp: 0 });
    settleBout(w, data, start.fight, start.bout, {
      outcome: 'enemy',
      rounds: 3,
      deaths: 1,
      battle: start.fight.battle,
    });
    expect(member(w, 'Snag').dead).toBe(true);
    expect(member(w, 'Grukk')).toMatchObject({ dead: false, frail: true });
    expect(w.purse).toBe(490);
    expect(w.log.at(-1)).toContain('The party is dragged from the arena, beaten.');
  });
});

describe('world save version 3', () => {
  it('upgrades with no coach trip or arena bout', () => {
    const w = world();
    const save = JSON.parse(serializeWorld(w));
    delete save.coach;
    delete save.arenaDay;
    const loaded = parseWorld(JSON.stringify({ ...save, schemaVersion: 3 }), data);
    expect(loaded.ok && loaded.world).toMatchObject({ coach: null, arenaDay: null });
    w.coach = { route: 'west-road', to: 'eastmarch', path: [{ col: 4, row: 8 }], checkedDay: 0 };
    const again = parseWorld(serializeWorld(w), data);
    expect(again.ok && again.world.coach).toEqual(w.coach);
  });
});
