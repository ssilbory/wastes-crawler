import { describe, expect, it } from 'vitest';
import { enterDungeon, step } from '../../../src/game/dungeon/explore.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { clockTier, moveClock, reinforced } from '../../../src/game/world/clock.ts';
import { rollEnemies } from '../../../src/game/world/encounters.ts';
import {
  burnNotes,
  findNotes,
  keepNotes,
  pendingNotes,
  sellNotes,
  setName,
} from '../../../src/game/world/notes.ts';
import { turnInQuest } from '../../../src/game/world/quest-board.ts';
import { decideSeal, epilogue, sealBlocked } from '../../../src/game/world/seal.ts';
import { enterTown } from '../../../src/game/world/town.ts';
import type { World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { place } from '../dungeon/helpers.ts';
import { data, member, world } from './helpers.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';

const CINDERHOLD = { col: 6, row: 12 };
const GUTTERWICK = { col: 16, row: 15 };

/** The party in the Dark Lands, out in the hills. */
function dark(): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 2, row: 2 });
  return w;
}

describe("the warlord's clock (docs/rules-adaptation.md, Warlord's clock)", () => {
  it('moves within its six segments, no longer ticking by the month (Phase 13)', () => {
    const w = dark();
    w.day = 29;
    w.raid = { town: 'cinderhold', day: 999, fighting: false };
    emit(w, data, { kind: 'day-passed' });
    // The month's faction turn moves no assets yet, so nobody has met a goal.
    expect(w.clock).toBe(0);
    moveClock(w, data, 1, 'Once.');
    expect(w.log.at(-1)).toContain("The warlord's clock advances to 1 of 6.");
    moveClock(w, data, 1, 'Again.');
    expect(clockTier(w, data)).toBe(1);
    expect(w.log.at(-1)).toBe("Day 30, morning: The warlord's patrols grow bolder.");
    moveClock(w, data, 10, 'Lots.');
    expect(w.clock).toBe(6);
    const lines = w.log.length;
    moveClock(w, data, 1, 'Full.');
    expect(w.log).toHaveLength(lines);
    moveClock(w, data, -10, 'Gone.');
    expect(w.clock).toBe(0);
    expect(w.log.at(-1)).toContain('falls back to 0 of 6');
  });

  it('falls back for the quests and rescue the campaign names', () => {
    const w = dark();
    w.clock = 3;
    emit(w, data, { kind: 'quest-done', quest: 'mire-slavers' });
    expect(w.clock).toBe(2);
    emit(w, data, { kind: 'quest-done', quest: 'ashgate-rolls' });
    expect(w.clock).toBe(2);
    emit(w, data, { kind: 'captive-freed', captive: 'held-crafter' });
    expect(w.clock).toBe(1);
    emit(w, data, { kind: 'captive-freed', captive: 'merchant' });
    expect(w.clock).toBe(1);
    expect(w.log.at(-1)).toContain('one crafter fewer');
  });

  it('turns a quest in as a quest-done event', () => {
    const w = world();
    enterRegion(w, 'dark-lands', GUTTERWICK);
    w.clock = 2;
    w.quests['mire-slavers'] = { status: 'ready', step: 1, acceptedDay: 0 };
    expect(turnInQuest(w, data, 'mire-slavers')).toEqual({ ok: true });
    expect(w.clock).toBe(1);
  });

  it('brings the warlord patrols onto the tables tier by tier', () => {
    const only = (w: World) => {
      const table = data.content.encounterTables.find((t) => t.id === 'dl-plains');
      const total = (table?.entries ?? [])
        .filter((e) => (e.minClock ?? 0) <= w.clock)
        .reduce((s, e) => s + e.weight, 0);
      w.rng = scriptedRng([total, 1, 1, 1]);
      return rollEnemies(w, data, 'dl-plains');
    };
    const w = dark();
    expect(only(w).rows.flat()).not.toContain('war-engine');
    w.clock = 6;
    expect(only(w).rows).toEqual([['war-engine'], ['beastman-trooper', 'beastman-trooper']]);
  });

  it('adds a beastman to the warlord per tier, up to a full front row', () => {
    const w = dark();
    const enemies = [['beastman-trooper', 'beastman-trooper'], ['warlord']];
    expect(reinforced(w, data, enemies, undefined)).toBe(enemies);
    expect(reinforced(w, data, enemies, 'beastman-trooper')).toEqual(enemies);
    w.clock = 5;
    expect(reinforced(w, data, enemies, 'beastman-trooper')[0]).toHaveLength(4);
    expect(reinforced(w, data, [Array<string>(8).fill('x')], 'y')).toEqual([
      Array<string>(8).fill('x'),
      ['y', 'y'],
    ]);
    expect(
      reinforced(w, data, [Array<string>(8).fill('x'), Array<string>(8).fill('z')], 'y'),
    ).toEqual([Array<string>(8).fill('x'), Array<string>(8).fill('z')]);
    expect(reinforced(w, data, [], 'y')).toEqual([['y', 'y']]);
  });

  it("springs the warlord's last fight with his reinforcements", () => {
    const w = world();
    enterRegion(w, 'dark-lands', { col: 2, row: 21 });
    enterDungeon(w, data);
    w.clock = 4;
    w.quests['warlord-falls'] = { status: 'active', step: 1, acceptedDay: 0 };
    place(w, 'hold-hall', 3, 2, 'n');
    step(w, data, 'forward');
    // Tier 2: two more troopers, one to fill the front row and one beside the warlord.
    expect(w.encounter?.enemies).toEqual([
      [
        'beastman-trooper',
        'beastman-trooper',
        'war-engine',
        'war-engine',
        'predator-beastman',
        'predator-beastman',
        'war-engine',
        'beastman-trooper',
      ],
      ['warlord', 'beastman-trooper'],
    ]);
  });
});

describe("crafter's notes (docs/rules-adaptation.md, Crafter's notes)", () => {
  it('are found once, underground, and named', () => {
    const w = world();
    enterRegion(w, 'dark-lands', { col: 17, row: 22 });
    enterDungeon(w, data);
    place(w, 'vats-hall', 1, 2, 'n');
    step(w, data, 'forward');
    expect(w.notes).toEqual({ 'vats-notes': 'found' });
    expect(w.log.at(-1)).toContain("The party takes the vat-master's notes.");
    findNotes(w, data, 'vats-notes', 'again');
    expect(w.log.at(-1)).not.toContain('again');
    expect(pendingNotes(w)).toEqual(['vats-notes']);
    expect(() => setName(data, 'lost')).toThrow('unknown notes lost');
  });

  it('burn anywhere, setting the clock back, while beastmen watch', () => {
    const w = dark();
    w.clock = 2;
    const fizz = member(w, 'Fizzwick');
    fizz.character = { ...fizz.character, people: 'beastman', lineage: 'herd' };
    expect(burnNotes(w, data, 'vats-notes')).toEqual({
      ok: false,
      reason: 'The party has no such notes to decide on.',
    });
    w.notes['vats-notes'] = 'found';
    expect(burnNotes(w, data, 'vats-notes')).toEqual({ ok: true });
    expect(w.notes['vats-notes']).toBe('burned');
    expect(w.clock).toBe(1);
    expect(w.log.join('\n')).toContain('Fizzwick watches them burn');
  });

  it('sell only in town, for crowns, advancing the clock', () => {
    const w = dark();
    w.purse = 0;
    w.notes['grisk-notes'] = 'found';
    expect(sellNotes(w, data, 'grisk-notes')).toEqual({
      ok: false,
      reason: "A warlord's agent can only be found in a town.",
    });
    enterRegion(w, 'dark-lands', GUTTERWICK);
    expect(sellNotes(w, data, 'grisk-notes')).toEqual({ ok: true });
    expect(w.purse).toBe(150);
    expect(w.clock).toBe(1);
    expect(sellNotes(w, data, 'grisk-notes')).toMatchObject({ ok: false });
  });

  it('keep, and Gorvash pays for them in Cinderhold, once', () => {
    const w = dark();
    w.purse = 0;
    w.notes = { 'vats-notes': 'found', 'grisk-notes': 'burned' };
    expect(keepNotes(w, data, 'vats-notes')).toEqual({ ok: true });
    expect(keepNotes(w, data, 'vats-notes')).toMatchObject({ ok: false });
    enterRegion(w, 'dark-lands', GUTTERWICK);
    enterTown(w, data, 'gutterwick');
    expect(w.notes['vats-notes']).toBe('kept');
    enterRegion(w, 'dark-lands', CINDERHOLD);
    enterTown(w, data, 'cinderhold');
    expect(w.notes['vats-notes']).toBe('paid');
    expect(w.purse).toBeGreaterThanOrEqual(30);
    expect(w.log.join('\n')).toContain("Elder Gorvash locks the vat-master's notes away");
  });

  it('are left alone when the giver is nowhere to be found', () => {
    const lost: GameData = {
      ...data,
      content: {
        ...data.content,
        campaign: {
          ...data.content.campaign,
          notes: { ...data.content.campaign.notes, giver: 'nobody' },
        },
      },
    };
    const w = dark();
    w.notes['vats-notes'] = 'kept';
    emit(w, lost, { kind: 'town-entered', town: 'cinderhold' });
    expect(w.notes['vats-notes']).toBe('kept');
  });
});

describe('the Seal of Command (docs/rules-adaptation.md, The ending)', () => {
  /** The warlord dead and the seal in hand, in Cinderhold. */
  function won(): World {
    const w = world();
    enterRegion(w, 'dark-lands', CINDERHOLD);
    w.quests['warlord-falls'] = { status: 'done', step: 2, acceptedDay: 0 };
    w.authority = ['lieutenants-token', 'seal-of-command'];
    w.purse = 0;
    return w;
  }

  it('can be decided only once the warlord is dead, with the seal, at Gorvash', () => {
    const w = world();
    expect(sealBlocked(w, data, 'cinderhold')).toBe('The warlord still lives.');
    w.quests['warlord-falls'] = { status: 'done', step: 2, acceptedDay: 0 };
    expect(sealBlocked(w, data, 'cinderhold')).toBe('The party does not hold the seal.');
    w.authority = ['seal-of-command'];
    expect(sealBlocked(w, data, 'gutterwick')).toBe('Bring the seal to Elder Gorvash.');
    expect(sealBlocked(w, data, 'cinderhold')).toBeNull();
    expect(epilogue(w, data)).toBeNull();
    const nobody: GameData = {
      ...data,
      content: {
        ...data.content,
        campaign: {
          ...data.content.campaign,
          seal: { ...data.content.campaign.seal, giver: 'nobody' },
        },
      },
    };
    expect(sealBlocked(w, nobody, 'cinderhold')).toBe('Bring the seal to the giver.');
  });

  it('destroyed, pays XP to all, and the dead get theirs when raised', () => {
    const w = won();
    member(w, 'Snag').dead = true;
    const xp = member(w, 'Grukk').character.xp;
    expect(decideSeal(w, data, 'cinderhold', 'destroy')).toEqual({ ok: true });
    expect(w.authority).toEqual(['lieutenants-token']);
    expect(member(w, 'Grukk').character.xp).toBe(xp + 3);
    expect(member(w, 'Snag').pendingXp).toBe(3);
    expect(w.log.at(-1)).toContain("The seal cracks in Cinderhold's forge fire.");
    expect(w.log.at(-1)).toContain("No crafter's notes survive in safe hands.");
    expect(decideSeal(w, data, 'cinderhold', 'keep')).toEqual({
      ok: false,
      reason: 'The seal’s fate is decided.',
    });
  });

  it('given, pays crowns; kept, stays with the party; kept notes are counted', () => {
    const g = won();
    expect(decideSeal(g, data, 'cinderhold', 'give')).toEqual({ ok: true });
    expect(g.purse).toBe(300);
    expect(g.authority).not.toContain('seal-of-command');
    const k = won();
    k.notes = { 'vats-notes': 'paid', 'grisk-notes': 'kept' };
    expect(decideSeal(k, data, 'cinderhold', 'keep')).toEqual({ ok: true });
    expect(k.authority).toContain('seal-of-command');
    expect(k.ending).toBe('keep');
    expect(epilogue(k, data)).toContain('lie 2 sets of crafter');
  });
});

describe('tokens found underground', () => {
  it("give the party the lieutenant's token, once", () => {
    const w = world();
    enterRegion(w, 'dark-lands', { col: 20, row: 2 });
    enterDungeon(w, data);
    place(w, 'bunker-barracks', 3, 3, 's');
    step(w, data, 'forward');
    expect(w.authority).toEqual(['lieutenants-token']);
    expect(w.log.join('\n')).toContain("In the officers' quarters, a brass token hangs");
    const lines = w.log.length;
    step(w, data, 'back');
    step(w, data, 'forward');
    expect(w.log).toHaveLength(lines);
  });
});
