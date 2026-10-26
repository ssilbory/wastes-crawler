import { describe, expect, it } from 'vitest';
import {
  difficultySeed,
  difficultyTier,
  partyLevel,
  simulateDifficulty,
} from '../../../src/game/world/difficulty.ts';
import { applyBattle, encounterBattle, xpText } from '../../../src/game/world/fight.ts';
import { partySetup } from '../../../src/game/world/battle-setup.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, member, world, encounter } from './helpers.ts';

const plains = { col: 5, row: 9 };

describe('the XP difficulty simulation (docs/rules-adaptation.md, XP)', () => {
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
    expect(difficultySeed(w)).toBe(`difficulty-${before.join('-')}`);
    expect(w.rng.state()).toEqual(before);
  });

  it('replays the party as it stands, repeatably, and grades it by PCs going down', () => {
    const w = world();
    const easy = simulateDifficulty(data, partySetup(w, data, [['peaceful-human']], true), 't', 20);
    expect(easy).toEqual({ downRate: 0, winRate: 1 });
    expect(difficultyTier(data, easy).name).toBe('trivial');
    const barbarians = partySetup(w, data, [Array(4).fill('barbarian-fighter')], true);
    const fair = simulateDifficulty(data, barbarians, 't', 40);
    expect(simulateDifficulty(data, barbarians, 't', 40)).toEqual(fair);
    expect(fair.downRate).toBeGreaterThan(0.05);
    // The same fight is harder for a battered party.
    const beast = [['predator-large-vicious']];
    const fresh = simulateDifficulty(data, partySetup(w, data, beast, true), 't', 40);
    for (const m of w.members)
      m.character = { ...m.character, hp: { ...m.character.hp, current: 1 } };
    const hurt = simulateDifficulty(data, partySetup(w, data, beast, true), 't', 40);
    expect(hurt.downRate).toBeGreaterThan(fresh.downRate);
    const titan = partySetup(w, data, [['legendary-god-titan']], true);
    const deadly = simulateDifficulty(data, titan, 't', 5);
    expect(deadly.winRate).toBeLessThan(0.5);
    expect(difficultyTier(data, deadly)).toMatchObject({ name: 'deadly', xp: 3 });
    // The fight log and the journal tell it the same way.
    expect(xpText(data, deadly)).toBe('A deadly fight: 3 XP each.');
    expect(xpText(data, easy)).toBe('A trivial fight: 0 XP each.');
  });

  it('counts only PCs going down, not NPCs', () => {
    const w = world();
    const setup = partySetup(w, data, [['thug-or-militia']], true);
    setup.party = [];
    setup.npcs = [
      {
        monster: 'peaceful-human',
        name: 'Merrit',
        row: 1,
        column: 0,
        hp: 1,
        maxHp: 1,
        noncombatant: false,
      },
    ];
    const d = simulateDifficulty(data, setup, 't', 10);
    expect(d.downRate).toBe(0);
    expect(d.winRate).toBeLessThan(1);
  });
});

describe('fight rewards', () => {
  it('pays loot dice and XP for a win; the dead get theirs when raised', () => {
    const w = world();
    w.position = plains;
    w.encounter = encounter([
      ['thug-or-militia', 'thug-or-militia'],
      ['petty-mage', 'small-pack-predator'],
    ]);
    const fight = encounterBattle(w, data);
    Object.assign(fight.battle.combatants[1] ?? {}, { status: 'dead', hp: 0 });
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 3, deaths: 1, battle: fight.battle },
      { downRate: 0.3, winRate: 0.9 },
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
    const beasts = encounter([['herd-beast']]);
    w.encounter = beasts;
    let fight = encounterBattle(w, data);
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: fight.battle },
      { downRate: 0, winRate: 1 },
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
      { downRate: 1, winRate: 0 },
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

  it('loads a version 24 save with no prayers, show, or named monsters', () => {
    const w = world();
    w.benched = [w.members.pop() as (typeof w.members)[number]];
    const save = JSON.parse(serializeWorld(w));
    const { performedDay, bestiary, ...rest } = save;
    expect([performedDay, bestiary]).toEqual([null, []]);
    const unprayed = (list: Record<string, unknown>[]) =>
      list.map((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'prayedDay')));
    const v24 = {
      ...rest,
      schemaVersion: 24,
      members: unprayed(save.members),
      benched: unprayed(save.benched),
    };
    const loaded = parseWorld(JSON.stringify(v24), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    expect(loaded.world).toMatchObject({ performedDay: null, bestiary: [] });
    expect(
      [...loaded.world.members, ...loaded.world.benched].every((m) => m.prayedDay === null),
    ).toBe(true);
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
