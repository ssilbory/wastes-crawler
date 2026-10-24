import { describe, expect, it } from 'vitest';
import type { GameData } from '../../../src/game/character/context.ts';
import { hike } from '../../../src/game/world/activities.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { boardCoach, coachQuarter } from '../../../src/game/world/coach.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { dismiss } from '../../../src/game/world/hire.ts';
import { addNpc, npcMonster } from '../../../src/game/world/npcs.ts';
import { passQuarter } from '../../../src/game/world/quarter.ts';
import {
  abandonQuest,
  acceptQuest,
  cannotAccept,
  giversHere,
  questsFrom,
  turnInQuest,
} from '../../../src/game/world/quest-board.ts';
import { currentStep, questOf } from '../../../src/game/world/quests.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { enterTown, wipe } from '../../../src/game/world/town.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, encounter, member, world } from './helpers.ts';

const at = (w: World, col: number, row: number) => {
  w.position = { col, row };
  return w;
};
/** Every PC at the given level. */
const levelled = (w: World, level: number) => {
  for (const m of w.members)
    m.character = {
      ...m.character,
      classes: { ...m.character.classes, levels: { [m.character.classes.current]: level } },
    };
  return w;
};
const won = (w: World) => {
  const fight = encounterBattle(w, data);
  applyBattle(
    w,
    data,
    fight,
    { outcome: 'party', rounds: 2, deaths: 0, battle: fight.battle },
    null,
  );
};

describe('the quest board (docs/rules-adaptation.md, Quests)', () => {
  it('lists the town’s givers and their quests', () => {
    const w = world();
    expect(giversHere(w, data).map((g) => g.name)).toEqual([
      'Reeve Halda',
      'Ysolde the Necromancer',
    ]);
    expect(questsFrom(data, 'reeve-halda').map((q) => q.id)).toEqual([
      'bandit-camp',
      'surveyor',
      'barrow-torc',
      'east-road',
    ]);
    expect(() => questOf(data, 'grail')).toThrow('unknown quest grail');
  });

  it('offers a quest once its prerequisites are met', () => {
    const w = world();
    expect(cannotAccept(w, data, questOf(data, 'bandit-camp'))).toBeNull();
    expect(cannotAccept(w, data, questOf(data, 'surveyor'))).toBe('First: The Raider Camp.');
    expect(cannotAccept(w, data, questOf(data, 'watchtower'))).toBe('Needs a party of level 2.');
    w.quests['bandit-camp'] = { status: 'done', step: 1, acceptedDay: 0 };
    expect(cannotAccept(w, data, questOf(data, 'surveyor'))).toBeNull();
    expect(cannotAccept(w, data, questOf(data, 'bandit-camp'))).toBe('Already taken.');
  });

  it('takes a quest from a giver in this town, outside encounters', () => {
    const w = world();
    expect(acceptQuest(w, data, 'letters')).toEqual({
      ok: false,
      reason: "Factor Imre isn't here.",
    });
    expect(acceptQuest(w, data, 'surveyor')).toEqual({
      ok: false,
      reason: 'First: The Raider Camp.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(acceptQuest(w, data, 'bandit-camp')).toMatchObject({ ok: false });
    w.encounter = null;
    expect(acceptQuest(w, data, 'bandit-camp')).toEqual({ ok: true });
    expect(w.quests['bandit-camp']).toEqual({ status: 'active', step: 0, acceptedDay: 0 });
    expect(w.log.at(-1)).toBe('Day 1, morning: The party takes on The Raider Camp.');
    expect(currentStep(w, data, 'bandit-camp')?.kind).toBe('slay');
    expect(currentStep(w, data, 'letters')).toBeUndefined();
  });
});

describe('slay and scout steps', () => {
  it('springs the fixed encounter on arrival, and finishes on a win', () => {
    const w = world();
    acceptQuest(w, data, 'bandit-camp');
    at(w, 6, 11);
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
    at(w, 6, 12);
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toMatchObject({
      quest: 'bandit-camp',
      hostile: true,
      enemies: [
        ['human-raider', 'human-raider', 'human-raider', 'paladin', 'paladin', 'paladin'],
        ['alliance-ranger'],
      ],
    });
    expect(w.encounter?.text).toContain(
      'Break the raider camp in the forest at 6,12. The enemy is here.',
    );
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.quests['bandit-camp']?.step).toBe(0);
    won(w);
    expect(w.quests['bandit-camp']?.status).toBe('ready');
    expect(w.log.join('\n')).toContain(
      'The Raider Camp: done. Return to Reeve Halda in Rubblegate (3,8) for the reward.',
    );
  });

  it('meets the camp when a hike walks into it, ending the quarter', () => {
    const w = world();
    w.rng = createRng('camp');
    acceptQuest(w, data, 'bandit-camp');
    at(w, 6, 11);
    w.visited.add('6,11');
    w.visited.add('6,12');
    w.destination = { col: 6, row: 13 };
    hike(w, data, 'm-2', false);
    expect(w.position).toEqual({ col: 6, row: 12 });
    expect(w.encounter?.quest).toBe('bandit-camp');
    w.encounter = null;
    at(w, 6, 11);
    w.destination = { col: 6, row: 12 };
    expect(passQuarter(w, data, { kind: 'hike', leader: 'm-2', watcher: null })).toBe(true);
    expect(w).toMatchObject({ quarter: 0, encounter: { quest: 'bandit-camp' } });
  });

  it('scouts a hex, then springs the next step there at once', () => {
    const w = levelled(at(world(), 17, 4), 2);
    expect(acceptQuest(w, data, 'watchtower')).toEqual({ ok: true });
    at(w, 12, 2);
    emit(w, data, { kind: 'hex-entered' });
    expect(w.quests.watchtower?.step).toBe(1);
    expect(w.encounter?.quest).toBe('watchtower');
    expect(w.log.join('\n')).toContain(
      'The Old Watchtower: Drive the beastmen out of the watchtower.',
    );
    emit(w, data, { kind: 'hex-entered' });
    expect(w.quests.watchtower?.step).toBe(1);
  });

  it('stops a coach that rolls into a fixed encounter on the road', () => {
    const quests = data.content.quests.map((q) =>
      q.id === 'bandit-camp'
        ? {
            ...q,
            objectives: [
              { ...(q.objectives[0] as (typeof q.objectives)[0]), hex: { col: 5, row: 8 } },
            ],
          }
        : q,
    );
    const road: GameData = { ...data, content: { ...data.content, quests } };
    const w = world();
    w.purse = 500;
    acceptQuest(w, road, 'bandit-camp');
    boardCoach(w, road, 'west-road');
    w.rng = createRng('road');
    w.rng.int = ((int) => (min: number, max: number) =>
      max === 6 && min === 1 ? 6 : int(min, max))(w.rng.int);
    coachQuarter(w, road);
    expect(w.position).toEqual({ col: 5, row: 8 });
    expect(w.encounter?.quest).toBe('bandit-camp');
    expect(w.coach?.path).toHaveLength(15);
  });
});

describe('deliver and escort steps', () => {
  it('delivers a quest item on reaching the town', () => {
    const w = at(world(), 20, 8);
    expect(acceptQuest(w, data, 'letters')).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('They carry a satchel of sealed letters.');
    at(w, 3, 8);
    enterTown(w, data, 'westhold');
    expect(w.quests.letters?.status).toBe('active');
    at(w, 17, 4);
    enterTown(w, data, 'highcairn');
    expect(w.quests.letters?.status).toBe('ready');
  });

  it('brings an escort along in an NPC slot, and hands them over in town', () => {
    const w = world();
    w.quests['bandit-camp'] = { status: 'done', step: 1, acceptedDay: 0 };
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'A', true);
    addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'B', true);
    expect(acceptQuest(w, data, 'surveyor')).toEqual({
      ok: false,
      reason: 'Make room in the party for Engineer Tamsin.',
    });
    w.npcs = [];
    expect(acceptQuest(w, data, 'surveyor')).toEqual({ ok: true });
    expect(w.npcs[0]).toMatchObject({
      kind: 'escort',
      type: 'surveyor',
      name: 'Engineer Tamsin',
      row: 1,
    });
    at(w, 20, 8);
    enterTown(w, data, 'eastmarch');
    expect(w.npcs).toEqual([]);
    expect(w.quests.surveyor?.status).toBe('ready');
  });

  it('fails when the escort dies, is captured, or is left behind', () => {
    const escorted = () => {
      const w = world();
      w.rng = createRng('escort');
      w.quests['bandit-camp'] = { status: 'done', step: 1, acceptedDay: 0 };
      acceptQuest(w, data, 'surveyor');
      return at(w, 5, 9);
    };
    const killed = escorted();
    killed.encounter = encounter([['thug-or-militia']]);
    let fight = encounterBattle(killed, data);
    Object.assign(fight.battle.combatants[4] ?? {}, { status: 'dead', hp: 0 });
    applyBattle(
      killed,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: fight.battle },
      null,
    );
    expect(killed.quests.surveyor?.status).toBe('failed');
    expect(killed.log.join('\n')).toContain('The Engineer has failed: Engineer Tamsin is lost.');
    const taken = escorted();
    taken.encounter = encounter([['thug-or-militia']]);
    fight = encounterBattle(taken, data);
    applyBattle(
      taken,
      data,
      fight,
      { outcome: 'enemy', rounds: 1, deaths: 0, battle: fight.battle },
      null,
    );
    expect(taken.quests.surveyor?.status).toBe('failed');
    expect(taken.log.join('\n')).toContain('Engineer Tamsin is taken captive.');
    const left = escorted();
    expect(dismiss(left, data, 'npc-0')).toEqual({ ok: true });
    expect(left.quests.surveyor?.status).toBe('failed');
    expect(left.log.join('\n')).toContain('The party leaves Engineer Tamsin behind.');
  });
});

describe('deadlines, turning in, and abandoning', () => {
  it('counts the night a lost fight costs against the deadline', () => {
    const w = world();
    acceptQuest(w, data, 'bandit-camp');
    w.day = 10;
    wipe(w, data);
    expect(w.day).toBe(11);
    expect(w.quests['bandit-camp']?.status).toBe('failed');
  });

  it('fails an unfinished quest when its days run out', () => {
    const w = world();
    acceptQuest(w, data, 'bandit-camp');
    w.day = 9;
    for (const m of w.members) m.slept = true;
    endOfDay(w, data);
    expect(w.quests['bandit-camp']?.status).toBe('active');
    w.day = 10;
    endOfDay(w, data);
    expect(w.quests['bandit-camp']?.status).toBe('failed');
    expect(w.log.join('\n')).toContain('The Raider Camp has failed: time ran out.');
    expect(acceptQuest(w, data, 'bandit-camp')).toEqual({ ok: false, reason: 'Already taken.' });
    const done = world();
    done.quests['bandit-camp'] = { status: 'ready', step: 1, acceptedDay: 0 };
    done.day = 30;
    endOfDay(done, data);
    expect(done.quests['bandit-camp']?.status).toBe('ready');
  });

  it('pays crowns, XP, and loot to the giver’s party on turn-in', () => {
    const w = world();
    w.purse = 0;
    expect(turnInQuest(w, data, 'bandit-camp')).toEqual({
      ok: false,
      reason: "The Raider Camp isn't finished.",
    });
    w.quests.watchtower = { status: 'ready', step: 2, acceptedDay: 0 };
    expect(turnInQuest(w, data, 'watchtower')).toEqual({
      ok: false,
      reason: "Warden Osk isn't here.",
    });
    member(w, 'Snag').dead = true;
    at(w, 17, 4);
    expect(turnInQuest(w, data, 'watchtower')).toEqual({ ok: true });
    expect(w.quests.watchtower?.status).toBe('done');
    expect(w.purse).toBe(80);
    expect(member(w, 'Grukk').character.xp).toBe(3);
    expect(member(w, 'Snag').pendingXp).toBe(3);
    expect(w.loot).toEqual([{ count: 2, sides: 6 }]);
    expect(w.countersigns).toEqual(['ash-road-patrol']);
    expect(w.log.at(-2)).toContain(
      'Warden Osk pays for The Old Watchtower: 80 crowns and 3 XP each.',
    );
  });

  it('abandons a quest under way, never again', () => {
    const w = world();
    expect(abandonQuest(w, data, 'bandit-camp')).toEqual({
      ok: false,
      reason: 'That quest is not under way.',
    });
    acceptQuest(w, data, 'bandit-camp');
    expect(abandonQuest(w, data, 'bandit-camp')).toEqual({ ok: true });
    expect(w.quests['bandit-camp']?.status).toBe('failed');
    expect(abandonQuest(w, data, 'bandit-camp')).toMatchObject({ ok: false });
    w.quests.letters = { status: 'ready', step: 1, acceptedDay: 0 };
    expect(abandonQuest(w, data, 'letters')).toEqual({ ok: true });
  });
});

describe('world save version 4', () => {
  it('upgrades with no quests, and a wandering encounter', () => {
    const w = world();
    w.encounter = encounter([['thug-or-militia']]);
    const save = JSON.parse(serializeWorld(w));
    delete save.quests;
    delete save.encounter.quest;
    const loaded = parseWorld(JSON.stringify({ ...save, schemaVersion: 4 }), data);
    expect(loaded.ok && loaded.world).toMatchObject({ quests: {}, encounter: { quest: null } });
    const none = parseWorld(JSON.stringify({ ...save, schemaVersion: 4, encounter: null }), data);
    expect(none.ok && none.world.encounter).toBeNull();
  });
});

describe('quest odds and ends', () => {
  it('sends the escort away when its quest is abandoned, and ignores other deaths', () => {
    const w = world();
    w.quests['bandit-camp'] = { status: 'done', step: 1, acceptedDay: 0 };
    acceptQuest(w, data, 'surveyor');
    const guard = addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', 'G', true);
    if (!guard) throw new Error('no room');
    emit(w, data, { kind: 'npc-died', npc: guard });
    expect(w.quests.surveyor?.status).toBe('active');
    abandonQuest(w, data, 'surveyor');
    expect(w.npcs.map((n) => n.name)).toEqual(['G']);
  });

  it('needs an escort step behind an escort NPC', () => {
    const w = world();
    addNpc(w, data, 'escort', 'surveyor', 'peaceful-human', 'Tamsin', false);
    const odd = w.npcs[0];
    if (!odd) throw new Error('no NPC');
    expect(npcMonster(data, odd).id).toBe('peaceful-human');
    expect(() => npcMonster(data, { ...odd, type: 'letters' })).toThrow(
      'no escort for quest letters',
    );
  });
});

describe('two slays at one hex', () => {
  it('springs the second once the first fight is won, while the party is still there', () => {
    const original = questOf(data, 'bandit-camp');
    const twin = {
      ...data,
      content: {
        ...data.content,
        quests: [
          ...data.content.quests,
          { ...original, id: 'bandit-camp-twin', name: 'The Twin Camp' },
        ],
      },
    };
    const w = world();
    acceptQuest(w, data, 'bandit-camp');
    w.quests['bandit-camp-twin'] = {
      ...(w.quests['bandit-camp'] as NonNullable<(typeof w.quests)['bandit-camp']>),
    };
    at(w, 6, 12);
    emit(w, twin, { kind: 'hex-entered' });
    expect(w.encounter?.quest).toBe('bandit-camp');
    const fight = encounterBattle(w, twin);
    applyBattle(
      w,
      twin,
      fight,
      { outcome: 'party', rounds: 2, deaths: 0, battle: fight.battle },
      null,
    );
    expect(w.encounter?.quest).toBe('bandit-camp-twin');
  });
});
