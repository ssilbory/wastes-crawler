import { describe, expect, it } from 'vitest';
import {
  benchmarkSeed,
  benchmarkWarrior,
  difficultyTier,
  partyLevel,
  simulateDifficulty,
} from '../../../src/game/world/difficulty.ts';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, member, world } from './helpers.ts';

const plains = { col: 5, row: 9 };

describe('the XP benchmark (docs/rules-adaptation.md, XP)', () => {
  it('fields a Warrior at any level with average hit points', () => {
    const one = benchmarkWarrior(data, 1);
    expect(one.classes).toEqual({ current: 'full-warrior', levels: { 'full-warrior': 1 } });
    // 1d6+2 averages 5.5, +0 Con, +2 Die Hard: 7 rounded down, per level.
    expect(one.hp).toEqual({ max: 7, current: 7 });
    expect(benchmarkWarrior(data, 3).hp.max).toBe(21);
    const plain = { ...data.content.benchmarkWarrior, foci: [] };
    const noDieHard = { ...data, content: { ...data.content, benchmarkWarrior: plain } };
    expect(benchmarkWarrior(noDieHard, 1).hp.max).toBe(5);
  });

  it('takes the living PCs’ average level, rounded', () => {
    const w = world();
    expect(partyLevel(w, data)).toBe(1);
    const snag = member(w, 'Snag');
    snag.character = {
      ...snag.character,
      classes: { current: 'full-warrior', levels: { 'full-warrior': 3 } },
    };
    expect(partyLevel(w, data)).toBe(2);
    member(w, 'Grukk').dead = true;
    member(w, 'Lirael').dead = true;
    member(w, 'Fizzwick').dead = true;
    expect(partyLevel(w, data)).toBe(3);
    snag.dead = true;
    expect(partyLevel(w, data)).toBe(1);
  });

  it('seeds from the world’s RNG without advancing it', () => {
    const w = world();
    const before = w.rng.state();
    expect(benchmarkSeed(w)).toBe(`benchmark-${before.join('-')}`);
    expect(w.rng.state()).toEqual(before);
  });

  it('simulates the fight repeatably and grades it', () => {
    const easy = simulateDifficulty(data, [['peaceful-human']], 1, 'test', 10);
    expect(easy.winRate).toBe(1);
    expect(simulateDifficulty(data, [['peaceful-human']], 1, 'test', 10)).toEqual(easy);
    expect(difficultyTier(data, easy).name).toBe('trivial');
    const heroes = [['legendary-god-titan']];
    const deadly = simulateDifficulty(data, heroes, 1, 'test', 5);
    expect(deadly.winRate).toBeLessThan(0.15);
    expect(difficultyTier(data, deadly)).toMatchObject({ name: 'deadly', xp: 3 });
  });
});

describe('fight rewards', () => {
  it('pays loot dice and XP for a win; the dead get theirs when raised', () => {
    const w = world();
    w.position = plains;
    w.encounter = {
      enemies: [
        ['thug-or-militia', 'thug-or-militia'],
        ['petty-mage', 'small-pack-predator'],
      ],
      hostile: true,
      spotted: false,
      text: '',
    };
    const fight = encounterBattle(w, data);
    Object.assign(fight.battle.combatants[1] ?? {}, { status: 'dead', hp: 0 });
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 3, deaths: 1, battle: fight.battle },
      { winRate: 0.5, averageRounds: 3 },
    );
    expect(w.loot).toEqual([{ count: 4, sides: 6 }]);
    expect(w.log.slice(-2)).toEqual([
      'Day 1, morning: The party takes 4d6 of loot.',
      'Day 1, morning: A fair fight: 1 XP each.',
    ]);
    expect(member(w, 'Snag').character.xp).toBe(1);
    expect(member(w, 'Grukk')).toMatchObject({ dead: true, pendingXp: 1, character: { xp: 0 } });
  });

  it('gives nothing for trivial fights, beasts, draws, or no verdict', () => {
    const w = world();
    w.position = plains;
    const beasts = { enemies: [['herd-beast']], hostile: true, spotted: false, text: '' };
    w.encounter = beasts;
    let fight = encounterBattle(w, data);
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: fight.battle },
      { winRate: 1, averageRounds: 1 },
    );
    expect(w.loot).toEqual([]);
    expect(w.log.at(-1)).toContain('A trivial fight: 0 XP each.');
    expect(member(w, 'Snag').character.xp).toBe(0);
    w.encounter = { ...beasts, enemies: [['thug-or-militia']] };
    fight = encounterBattle(w, data);
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'draw', rounds: 100, deaths: 0, battle: fight.battle },
      {
        winRate: 0,
        averageRounds: 9,
      },
    );
    expect(w.loot).toEqual([]);
    w.encounter = { ...beasts, enemies: [['thug-or-militia']] };
    fight = encounterBattle(w, data);
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: fight.battle },
      null,
    );
    expect(w.loot).toEqual([{ count: 1, sides: 6 }]);
    expect(member(w, 'Snag').character.xp).toBe(0);
  });
});

describe('world save version 1', () => {
  it('upgrades, pooling the members’ crowns into the purse', () => {
    const w = world();
    const save = JSON.parse(serializeWorld(w));
    const { benched, purse, loot, towns, climateDay, ...rest } = save;
    expect([benched, purse, loot, towns, climateDay]).toHaveLength(5);
    const v1 = {
      ...rest,
      schemaVersion: 1,
      members: save.members.map((m: Record<string, unknown>, i: number) => ({
        ...Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'pendingXp')),
        character: { ...(m.character as object), crowns: i * 10 },
      })),
    };
    const loaded = parseWorld(JSON.stringify(v1), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    expect(loaded.world).toMatchObject({
      purse: 60,
      benched: [],
      loot: [],
      towns: {},
      climateDay: 0,
    });
    expect(loaded.world.members.every((m) => m.character.crowns === 0 && m.pendingXp === 0)).toBe(
      true,
    );
    expect(parseWorld(JSON.stringify({ ...save, extra: 1 }), data)).toEqual({
      ok: false,
      errors: ['(file): Unrecognized key: "extra"'],
    });
    const odd = { ...v1, members: [{ ...v1.members[0], character: undefined }] };
    expect(parseWorld(JSON.stringify(odd), data)).toMatchObject({ ok: false });
    expect(parseWorld(JSON.stringify({ ...v1, members: 'none' }), data)).toMatchObject({
      ok: false,
    });
  });

  it('round-trips benched members and the economy', () => {
    const w = world();
    w.benched = [w.members.pop() as (typeof w.members)[number]];
    Object.assign(w, { purse: 12.5, loot: [{ count: 2, sides: 6 }], climateDay: 3 });
    w.rng = createRng('round-trip');
    const loaded = parseWorld(serializeWorld(w), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    expect({ ...loaded.world, rng: null }).toEqual({ ...w, rng: null });
    const save = JSON.parse(serializeWorld(w));
    save.benched[0].character = { schemaVersion: 99 };
    expect(parseWorld(JSON.stringify(save), data)).toEqual({
      ok: false,
      errors: ['m-3: made by a newer version of the game (schema 99)'],
    });
  });
});
