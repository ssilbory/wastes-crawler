import { describe, expect, it } from 'vitest';
import { endOfDay } from '../../../src/game/world/day.ts';
import { leaveEncounter, maybeEncounter, rollEnemies } from '../../../src/game/world/encounters.ts';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { wipe } from '../../../src/game/world/town.ts';
import type { World } from '../../../src/game/world/types.ts';
import type { CasterState } from '../../../src/game/combat/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world, encounter } from './helpers.ts';

const plains = { col: 5, row: 9 };
const out = (w: World, at = plains) => {
  w.position = at;
  return w;
};

describe('wandering encounters (SRD 2.12.6, 5.2.1)', () => {
  it('rolls a weighted group with fixed or rolled numbers, eight to a row at most', () => {
    const w = world([1, 3]);
    expect(rollEnemies(w, data, 'plains')).toEqual({
      rows: [['human-raider', 'human-raider', 'human-raider', 'human-raider']],
      nature: 'hostile',
      captive: null,
    });
    w.rng = scriptedRng([4, 3]);
    expect(rollEnemies(w, data, 'plains')).toEqual({
      rows: [['alliance-ranger', 'alliance-ranger', 'alliance-ranger'], ['paladin']],
      nature: 'wary',
      captive: null,
    });
    w.rng = scriptedRng([13, 2]);
    expect(rollEnemies(w, data, 'plains')).toMatchObject({
      nature: 'hostile',
      captive: 'merchant',
    });
    const swarm = {
      ...data,
      content: {
        ...data.content,
        encounterTables: [
          {
            id: 'swarm',
            entries: [
              {
                weight: 1,
                nature: 'hostile' as const,
                groups: [{ monster: 'herd-beast', count: 12, row: 1 }],
              },
            ],
          },
        ],
      },
    };
    w.rng = scriptedRng([1]);
    expect(rollEnemies(w, swarm, 'swarm').rows).toEqual([Array(8).fill('herd-beast')]);
    expect(() => rollEnemies(w, data, 'moon')).toThrow('unknown encounter table moon');
  });

  it('checks on a 1, never in town, and sets up a hostile or peaceful meeting', () => {
    const w = world([2]);
    expect(maybeEncounter(out(w), data, undefined, false)).toBe(false);
    expect(maybeEncounter(out(w, { col: 3, row: 8 }), data, undefined, false)).toBe(false);
    // The last two faces are Fizzwick's Know roll, which misses.
    w.rng = scriptedRng([1, 1, 3, 1, 1, 1, 1]);
    expect(maybeEncounter(out(w), data, undefined, false)).toBe(true);
    expect(w.encounter).toEqual({
      enemies: [Array(4).fill('human-raider')],
      nature: 'hostile',
      // 2 on the dice, +1 for Lirael's Well-Met.
      reaction: 'unfriendly',
      parleyed: false,
      captive: null,
      offer: null,
      quest: null,
      hostile: true,
      spotted: false,
      text: 'The party meets 4 Human Raider. They look for a fight.',
    });
    expect(leaveEncounter(w)).toBe(false);
    w.encounter = null;
    w.rng = scriptedRng([1, 7, 2, 6, 6, 1, 1]);
    maybeEncounter(out(w), data, undefined, false);
    expect(w.encounter).toMatchObject({ hostile: false, text: expect.stringContaining('wave') });
    expect(leaveEncounter(w)).toBe(true);
    expect(w.log.at(-1)).toContain('The two groups go their ways.');
    expect(leaveEncounter(w)).toBe(false);
  });

  it('lets a watcher spot them first, at a disadvantage in the dark', () => {
    const w = world([1, 1, 3, 1, 1, 1, 1, 6, 6, 1, 1, 1]);
    const snag = member(w, 'Snag');
    maybeEncounter(out(w), data, snag, true);
    expect(w.encounter).toMatchObject({
      spotted: true,
      text: expect.stringMatching(/^Snag spots/),
    });
    expect(leaveEncounter(w)).toBe(true);
    expect(w.log.at(-1)).toContain('slips away unseen');
  });
});

describe('a fallen party', () => {
  it('wakes in the last town the next morning, the dead still dead', () => {
    const w = out(world());
    member(w, 'Snag').dead = true;
    w.quarter = 2;
    w.encounter = encounter([['thug-or-militia']]);
    w.destination = { col: 9, row: 9 };
    wipe(w, data);
    expect(w).toMatchObject({
      position: { col: 3, row: 8 },
      destination: null,
      encounter: null,
      day: 1,
      quarter: 0,
    });
    expect(member(w, 'Snag').dead).toBe(true);
    // Falling on the surface charts nothing.
    expect(w.charted).toEqual({});
    w.lastTown = 'atlantis';
    expect(() => wipe(w, data)).toThrow('unknown town atlantis');
  });
});

describe('the end of the day (SRD 2.12.4, 2.5.3)', () => {
  it('feeds, heals, and refreshes a rested, sheltered party', () => {
    const w = out(world([5]));
    const grukk = member(w, 'Grukk');
    grukk.character = { ...grukk.character, hp: { ...grukk.character.hp, current: 3 } };
    for (const m of w.members) Object.assign(m, { slept: true, spellsCast: 1 });
    w.camp = 'made';
    w.rations = 8;
    endOfDay(w, data);
    expect(grukk.character.hp.current).toBe(4);
    expect(member(w, 'Fizzwick').spellsCast).toBe(0);
    expect(w).toMatchObject({ rations: 8, camp: 'none', hikes: 0 });
    expect(grukk.slept).toBe(false);
  });

  it('makes the unfed Hungry and the unslept Sleepless, at 1 strain a day', () => {
    const w = out(world([2]));
    w.rations = 4;
    w.camp = 'made';
    member(w, 'Snag').slept = true;
    endOfDay(w, data);
    expect(w.rations).toBe(0);
    expect(w.log).toContainEqual(expect.stringContaining('The rations run low.'));
    expect(member(w, 'Grukk')).toMatchObject({ sleepless: true, hungry: false });
    expect(member(w, 'Grukk').character.strain.value).toBe(1);
    expect(member(w, 'Snag').sleepless).toBe(false);
    endOfDay(w, data);
    expect(w.log).toContainEqual(expect.stringContaining('There is nothing left to eat.'));
    expect(member(w, 'Snag')).toMatchObject({ hungry: true, sleepless: true });
    expect(member(w, 'Snag').character.strain.value).toBe(1);
  });

  it('makes harsh and winter nights without a camp Cold, and other unsheltered nights restless', () => {
    const w = out(world([5, 5, 5]), { col: 8, row: 1 });
    w.camp = 'none';
    for (const m of w.members) m.slept = true;
    endOfDay(w, data);
    expect(member(w, 'Snag').cold).toBe(true);
    for (const m of w.members) m.slept = true;
    out(w);
    w.day = 300;
    endOfDay(w, data);
    expect(member(w, 'Snag').cold).toBe(true);
    for (const m of w.members) m.slept = true;
    w.day = 0;
    const grukk = member(w, 'Grukk');
    grukk.character = { ...grukk.character, hp: { ...grukk.character.hp, current: 3 } };
    endOfDay(w, data);
    expect(grukk).toMatchObject({ cold: false });
    expect(grukk.character.hp.current).toBe(3);
    expect(w.log.at(-1)).toContain('A night without shelter at 5,9: no one recovers.');
  });

  it('eats free in town, and a ruined camp blocks recovery', () => {
    const w = world([]);
    for (const m of w.members) m.slept = true;
    w.noRecovery = true;
    const grukk = member(w, 'Grukk');
    grukk.character = { ...grukk.character, hp: { ...grukk.character.hp, current: 3 } };
    endOfDay(w, data);
    expect(grukk.character.hp.current).toBe(3);
    expect(grukk.hungry).toBe(false);
  });
});

describe('fighting encounters', () => {
  it('carries wounds, Frailty, and spent magic into the fight and back out', () => {
    const w = out(world());
    expect(() => encounterBattle(w, data)).toThrow('no encounter to fight');
    w.encounter = encounter([['thug-or-militia']]);
    const fizz = member(w, 'Fizzwick');
    Object.assign(fizz, { spellsCast: 1, effortDay: 1, frail: true });
    const lirael = member(w, 'Lirael');
    lirael.character = { ...lirael.character, hp: { ...lirael.character.hp, current: 0 } };
    const fight = encounterBattle(w, data);
    expect(fight.memberIds).toEqual(['m-0', 'm-1', 'm-3']);
    const [snagC, grukkC, fizzC] = fight.battle.combatants;
    const caster = fizzC?.caster as CasterState;
    expect(caster).toMatchObject({ spellsLeft: 0, effortDay: 1, effortUsed: 1 });
    expect(fizzC?.frail).toBe(true);
    Object.assign(snagC ?? {}, { status: 'dead', hp: 0 });
    Object.assign(grukkC ?? {}, { status: 'stable', hp: 0 });
    Object.assign(fizzC ?? {}, { hp: 2, frail: false });
    if (!fizzC) throw new Error('no Fizzwick');
    fizzC.strain = { strain: 3, max: 10, broken: false };
    caster.effortDay = 2;
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 3, deaths: 1, battle: fight.battle },
      null,
    );
    expect(member(w, 'Snag')).toMatchObject({ dead: true });
    expect(member(w, 'Grukk')).toMatchObject({ frail: true, character: { hp: { current: 1 } } });
    expect(fizz).toMatchObject({ frail: false, spellsCast: 1, effortDay: 2 });
    expect(fizz.character.strain.value).toBe(3);
    expect(w.encounter).toBeNull();
    expect(w.log.at(-2)).toContain('The party wins after 3 rounds.');
    w.encounter = encounter([['thug-or-militia']]);
    const quick = encounterBattle(w, data);
    applyBattle(
      w,
      data,
      quick,
      { outcome: 'party', rounds: 1, deaths: 0, battle: quick.battle },
      null,
    );
    expect(w.log.at(-2)).toContain('The party wins after 1 round.');
  });

  it('notes a broken-off fight, and a lost one sends the party to town', () => {
    const w = out(world());
    w.encounter = encounter([['thug-or-militia']]);
    const member0 = member(w, 'Snag');
    member0.character = { ...member0.character, strain: { value: 0, broken: false } };
    let fight = encounterBattle(w, data);
    Object.assign(fight.battle.combatants[0] ?? {}, { strain: null });
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'draw', rounds: 100, deaths: 0, battle: fight.battle },
      null,
    );
    expect(w.log.at(-1)).toContain('The fight breaks off.');
    w.encounter = encounter([['thug-or-militia']]);
    fight = encounterBattle(w, data);
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'enemy', rounds: 4, deaths: 0, battle: fight.battle },
      null,
    );
    expect(w.position).toEqual({ col: 3, row: 8 });
  });
});
