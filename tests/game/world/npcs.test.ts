import { describe, expect, it } from 'vitest';
import { hike } from '../../../src/game/world/activities.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { dismiss, hire, stowWithPorter, takeFromPorter } from '../../../src/game/world/hire.ts';
import {
  addNpc,
  captiveOf,
  freeSlot,
  hirelingType,
  moraleAfterFight,
  monsterOf,
  npcRoom,
} from '../../../src/game/world/npcs.ts';
import { suggestPlan } from '../../../src/game/world/plans.ts';
import type { Npc, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from './helpers.ts';

/** The starters in Westhold with crowns to spend and scripted dice. */
function town(faces: number[] = []): World {
  const w = world(faces);
  w.purse = 500;
  return w;
}

describe('hiring (SRD 3.3.0)', () => {
  it('signs on a hireling with rolled hit points, fighters in front', () => {
    const w = town([5]);
    expect(hire(w, data, 'guard')).toEqual({ ok: true });
    expect(w.npcs).toEqual([
      {
        id: 'npc-0',
        kind: 'hireling',
        type: 'guard',
        name: 'Aldo',
        hp: 5,
        maxHp: 5,
        row: 0,
        column: 2,
        quitting: false,
        inventory: [],
        owed: 0,
      },
    ]);
    expect(w.log.at(-1)).toContain('Aldo signs on as a Guard for a quarter share of the loot.');
    expect(w.purse).toBe(480);
    w.rng = scriptedRng([3]);
    hire(w, data, 'porter');
    expect(w.npcs[1]).toMatchObject({ id: 'npc-1', name: 'Brenna', row: 1, column: 2 });
  });

  it('has room for two NPCs, outside encounters, and only in town', () => {
    const w = town([5, 5]);
    hire(w, data, 'guard');
    hire(w, data, 'guard');
    expect(hire(w, data, 'guard')).toEqual({ ok: false, reason: 'The party has room for 2 NPCs.' });
    w.encounter = encounter([['thug-or-militia']]);
    expect(hire(w, data, 'guard')).toEqual({ ok: false, reason: 'Settle the encounter first.' });
    w.position = { col: 5, row: 9 };
    expect(() => hire(w, data, 'guard')).toThrow('the party is not in a town');
    expect(() => hirelingType(data, 'butler')).toThrow('unknown hireling butler');
    expect(() => monsterOf(data, 'dragon')).toThrow('unknown monster dragon');
    expect(() => captiveOf(data, 'prince')).toThrow('unknown captive prince');
  });

  it('places NPCs in free formation slots, falling back to the other row', () => {
    const w = town();
    expect(freeSlot(w, false)).toEqual({ row: 1, column: 2 });
    for (const [row, column] of [
      [0, 2],
      [0, 3],
      [1, 2],
      [1, 3],
    ] as const)
      w.members.push({ ...member(w, 'Snag'), id: `x-${row}-${column}`, row, column });
    expect(freeSlot(w, true)).toBeNull();
    expect(npcRoom(w, true)).toBeNull();
    const two = town([1, 1, 1]);
    addNpc(two, data, 'hireling', 'guard', 'thug-or-militia', 'A', true);
    addNpc(two, data, 'hireling', 'guard', 'thug-or-militia', 'B', true);
    expect(addNpc(two, data, 'hireling', 'guard', 'thug-or-militia', 'C', true)).toBeNull();
  });

  it('dismisses anyone, but not a porter still carrying a load', () => {
    const w = town([4, 4, 2]);
    hire(w, data, 'guard');
    hire(w, data, 'porter');
    stowWithPorter(w, data, 'm-0', 4, 'npc-1');
    expect(dismiss(w, data, 'npc-1')).toEqual({ ok: false, reason: "Take Brenna's load first." });
    expect(dismiss(w, data, 'npc-0')).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('Aldo is let go.');
    addNpc(w, data, 'captive', 'merchant', 'peaceful-human', 'Merrit', false);
    dismiss(w, data, 'npc-0');
    expect(w.log.at(-1)).toContain('The party leaves Merrit behind.');
    expect(() => dismiss(w, data, 'npc-9')).toThrow('no NPC npc-9');
  });
});

describe('porters', () => {
  it('carry up to twelve stowed items, handed over and back one at a time', () => {
    const w = town([4, 4]);
    hire(w, data, 'porter');
    expect(stowWithPorter(w, data, 'm-0', 4, 'npc-0')).toEqual({ ok: true });
    expect(w.npcs[0]?.inventory).toEqual([
      { id: 'dungeoneering-kit', quantity: 1, location: 'stowed' },
    ]);
    expect(member(w, 'Snag').character.inventory).toHaveLength(4);
    const snag = member(w, 'Snag');
    snag.character = {
      ...snag.character,
      inventory: [
        ...snag.character.inventory,
        { id: 'rations-one-week', quantity: 3, location: 'stowed' },
      ],
    };
    // The kit is 6 and a week of rations 4: a second week would make 14.
    expect(stowWithPorter(w, data, 'm-0', 4, 'npc-0')).toEqual({ ok: true });
    expect(stowWithPorter(w, data, 'm-0', 4, 'npc-0')).toEqual({
      ok: false,
      reason: "Aldo can't carry any more.",
    });
    expect(w.npcs[0]?.inventory[1]).toMatchObject({ id: 'rations-one-week', quantity: 1 });
    expect(takeFromPorter(w, data, 'npc-0', 1, 'm-3')).toEqual({ ok: true });
    expect(takeFromPorter(w, data, 'npc-0', 0, 'm-3')).toMatchObject({ ok: false });
    expect(takeFromPorter(w, data, 'npc-0', 0, 'm-0')).toEqual({ ok: true });
    expect(w.npcs[0]?.inventory).toEqual([]);
    expect(() => stowWithPorter(w, data, 'm-0', 99, 'npc-0')).toThrow('no item 99 on m-0');
    expect(() => takeFromPorter(w, data, 'npc-0', 99, 'm-0')).toThrow('no item 99 on npc-0');
    hire(w, data, 'guard');
    expect(() => stowWithPorter(w, data, 'm-0', 0, 'npc-1')).toThrow('no porter npc-1');
  });
});

describe('wages, healing, Morale, and shares', () => {
  it('draws no wage overnight, and heals fed and sheltered', () => {
    const w = town([8, 8]);
    hire(w, data, 'guard');
    hire(w, data, 'veteran-sellsword');
    w.purse = 11;
    (w.npcs[0] as Npc).hp = 2;
    for (const m of w.members) m.slept = true;
    endOfDay(w, data);
    expect(w.purse).toBe(11);
    expect(w.npcs.map((n) => n.name)).toEqual(['Aldo', 'Brenna']);
    // Fed and sheltered in town: an NPC heals its hit dice.
    expect(w.npcs[0]?.hp).toBe(3);
    w.position = { col: 5, row: 9 };
    w.rations = 0;
    endOfDay(w, data);
    expect(w.npcs[0]?.hp).toBe(3);
  });

  it('tests hirelings’ Morale, quitting at the next town', () => {
    const w = town([5, 5]);
    hire(w, data, 'guard');
    addNpc(w, data, 'captive', 'merchant', 'peaceful-human', 'Merrit', false);
    // Thug Morale 7: 2d6 of 6 + 2 holds, 6 + 6 breaks.
    w.rng = scriptedRng([6, 2]);
    moraleAfterFight(w, data);
    expect(w.npcs[0]?.quitting).toBe(false);
    w.rng = scriptedRng([6, 6]);
    moraleAfterFight(w, data);
    expect(w.npcs[0]?.quitting).toBe(true);
    expect(w.log.at(-1)).toContain('Aldo has had enough and will leave at the next town.');
    moraleAfterFight(w, data);
  });

  it('steadies hirelings by a living Herd-Loyal beastman’s bonus', () => {
    const w = town([5, 5]);
    hire(w, data, 'guard');
    const snag = member(w, 'Snag');
    snag.character = {
      ...snag.character,
      foci: [...snag.character.foci, { id: 'herd-loyal', level: 2 }],
    };
    // Thug Morale 7 + 2: a roll of 9 holds.
    w.rng = scriptedRng([6, 3]);
    moraleAfterFight(w, data);
    expect(w.npcs[0]?.quitting).toBe(false);
    snag.dead = true;
    w.rng = scriptedRng([6, 3]);
    moraleAfterFight(w, data);
    expect(w.npcs[0]?.quitting).toBe(true);
  });
});

describe('Wilderness Guides', () => {
  it('lead the way with a flat +1, and are suggested when no PC does better', () => {
    const w = town([2]);
    hire(w, data, 'wilderness-guide');
    w.destination = { col: 9, row: 3 };
    for (const m of w.members) m.character = { ...m.character, skills: {} };
    expect(suggestPlan(w, data, 'hike')).toMatchObject({ kind: 'hike', leader: 'npc-0' });
    w.position = { col: 3, row: 6 };
    w.visited.add('3,6');
    w.destination = { col: 3, row: 5 };
    const before = w.log.length;
    // Forest needs 8 to find the way: 4 + 3 + the guide's 1 makes it.
    w.rng = scriptedRng([4, 3]);
    hike(w, data, 'npc-0', false);
    expect(w.position).toEqual({ col: 3, row: 5 });
    expect(w.log.length).toBe(before);
    // Nobody leading fails, and a travel mishap follows.
    w.position = { col: 3, row: 6 };
    w.visited.delete('3,5');
    w.destination = { col: 3, row: 5 };
    w.rng = createRng('lost');
    hike(w, data, 'nobody', false);
    expect(w.log.length).toBeGreaterThan(before);
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, skills: { survive: 2 } };
    w.destination = { col: 9, row: 3 };
    expect(suggestPlan(w, data, 'hike')).toMatchObject({ leader: 'm-0' });
  });
});
