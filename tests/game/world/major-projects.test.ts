import { describe, expect, it } from 'vitest';
import { dungeonOf } from '../../../src/game/dungeon/levels.ts';
import { startFactions } from '../../../src/game/factions/state.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import {
  adventuresDone,
  buyPrice,
  buyRenown,
  cannotWork,
  difficultyNow,
  hasCome,
  isGuardedHoard,
  progressOf,
  projectOf,
  renownEarned,
  spendRenown,
} from '../../../src/game/world/major-projects.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, starter, world } from './helpers.ts';

/** A campaign world standing in Cinderhold, on the Dark Lands map. */
function inCinderhold(): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 6, row: 12 });
  w.position = { col: 6, row: 12 };
  return w;
}

const done = (w: World, quest: string) => {
  w.quests[quest] = { status: 'done', step: 0, acceptedDay: 0 };
};

/** A guarded hoard's key in a shipped dungeon (the Wastes' strongholds have them). */
const hoard = data.content.dungeons.flatMap((d) =>
  d.levels.flatMap((l) =>
    l.specials.flatMap((s) =>
      s.kind === 'cache' && s.guards ? [`${d.id}/${l.id}/${s.at.x},${s.at.y}`] : [],
    ),
  ),
)[0] as string;

/** A shipped ruin's vault, by its fight's key. */
function vaultKey(): string {
  const ruin = data.content.ruins[0];
  if (!ruin) throw new Error('no ruins');
  const id = `${ruin.id}-v1`;
  for (const l of dungeonOf(data, id).levels)
    for (const s of l.specials)
      if (s.kind === 'cache' && s.vault && s.guards) return `${id}/${l.id}/${s.at.x},${s.at.y}`;
  throw new Error('no vault');
}

describe('earning Renown (docs/rules-adaptation.md, Major projects: Earning Renown)', () => {
  it('pays for quests, the warlord’s fall, boss fights, and captives brought home', () => {
    const w = world();
    emit(w, data, { kind: 'quest-done', quest: 'bandit-camp' });
    expect(w.renown).toBe(1);
    expect(w.log.at(-1)).toContain('1 Renown (1 to spend)');
    // Grisk dies in the Seal's quest: the quest's Renown and the warlord's.
    emit(w, data, { kind: 'quest-done', quest: data.content.campaign.seal.quest });
    expect(w.renown).toBe(4);
    emit(w, data, { kind: 'fight-won', quest: null, garrison: hoard });
    emit(w, data, { kind: 'fight-won', quest: null, garrison: vaultKey() });
    expect(w.renown).toBe(6);
    emit(w, data, { kind: 'captive-home', captive: 'merchant' });
    expect(w.renown).toBe(7);
    // A garrison post, a plain win, and other news earn nothing.
    emit(w, data, { kind: 'fight-won', quest: null, garrison: 'post-at-the-ford' });
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    emit(w, data, { kind: 'day-passed' });
    expect(w.renown).toBe(7);
  });

  it('earns nothing, and says nothing, where content awards none', () => {
    const w = world();
    const none = {
      ...data,
      content: {
        ...data.content,
        projects: {
          ...data.content.projects,
          renown: { quest: 0, boss: 0, captive: 0, warlord: 0 },
        },
      },
    };
    const lines = w.log.length;
    emit(w, none, { kind: 'quest-done', quest: 'bandit-camp' });
    expect(w.renown).toBe(0);
    expect(w.log.length).toBe(lines);
  });

  it('earns nothing in a realm without projects (the Sealed Vale)', () => {
    const party = [
      { character: starter('snag'), row: 0, column: 0, defaultAction: 'auto' as const },
    ];
    const w = newWorld(data, createRng('realm'), party, undefined, null, 'sealed-vale');
    emit(w, data, { kind: 'quest-done', quest: 'bandit-camp' });
    emit(w, data, { kind: 'fight-won', quest: null, garrison: hoard });
    expect(w.renown).toBe(0);
  });

  it('earns Renown in the Wastes (Sam’s call): a hoard 1, a warlord’s own hoard 2 and no more', () => {
    const party = [
      { character: starter('snag'), row: 0, column: 0, defaultAction: 'auto' as const },
    ];
    const w = newWorld(data, createRng('realm'), party, undefined, null, 'wastes');
    emit(w, data, { kind: 'fight-won', quest: null, garrison: hoard });
    expect(w.renown).toBe(1);
    emit(w, data, {
      kind: 'fight-won',
      quest: null,
      garrison: 'scrap-kings-pumpworks/scrap-kings-pumpworks-2/6,0',
    });
    expect(w.renown).toBe(3);
    expect(w.log.at(-1)).toContain('The warlord is dead: 2 Renown');
  });

  it('names only real caches with guards as boss fights', () => {
    expect(isGuardedHoard(data, hoard)).toBe(true);
    expect(isGuardedHoard(data, vaultKey())).toBe(true);
    expect(isGuardedHoard(data, 'atlantis/level-1/0,0')).toBe(false);
    expect(isGuardedHoard(data, 'old-barrow')).toBe(false);
    // An unguarded cache, and a cell with no cache.
    const d = data.content.dungeons.find((x) => x.id === 'drowned-cisterns');
    const level = d?.levels.find((l) => l.specials.some((s) => s.kind === 'cache'));
    const cache = level?.specials.find((s) => s.kind === 'cache');
    expect(
      isGuardedHoard(data, `drowned-cisterns/${level?.id}/${cache?.at.x},${cache?.at.y}`),
    ).toBe(false);
    expect(isGuardedHoard(data, 'drowned-cisterns/no-level/0,0')).toBe(false);
  });

  it('counts the Renown an older save had already earned', () => {
    expect(renownEarned(world(), data)).toBe(0);
    const w = world();
    done(w, 'bandit-camp');
    done(w, data.content.campaign.seal.quest);
    w.quests.surveyor = { status: 'active', step: 0, acceptedDay: 0 };
    w.beaten.push(hoard, 'post-at-the-ford');
    expect(renownEarned(w, data)).toBe(1 + 1 + 2 + 1);
    // Loading a version 50 campaign save counts it; a realm's stays at none.
    const raw = JSON.parse(serializeWorld(w)) as Record<string, unknown>;
    delete raw.renown;
    delete raw.majorProjects;
    raw.schemaVersion = 50;
    const loaded = parseWorld(JSON.stringify(raw), data);
    expect(loaded.ok && loaded.world.renown).toBe(5);
    expect(loaded.ok && loaded.world.majorProjects).toEqual({});
    const fresh = parseWorld(serializeWorld(w), data);
    expect(fresh.ok && fresh.world.renown).toBe(0);
    // A version 51 save's projects gain building work, help, and trouble, none of them yet.
    const v51 = JSON.parse(serializeWorld(w)) as Record<string, unknown>;
    v51.schemaVersion = 51;
    v51.majorProjects = { 'wall-lanternfall': { renown: 3, bought: 1, done: null } };
    const up = parseWorld(JSON.stringify(v51), data);
    expect(up.ok && up.world.majorProjects).toEqual({
      'wall-lanternfall': {
        renown: 3,
        bought: 1,
        done: null,
        daysLeft: null,
        help: [],
        trouble: null,
        shutUntil: null,
        specialist: null,
      },
    });
    // One without any comes through with none.
    delete v51.majorProjects;
    const bare = parseWorld(JSON.stringify(v51), data);
    expect(bare.ok && bare.world.majorProjects).toEqual({});
  });
});

describe('a project’s difficulty as it stands (SRD 7.4.0, 7.5.0)', () => {
  it('drops as its opposition is beaten, any one way', () => {
    const w = inCinderhold();
    const wall = projectOf(data, 'wall-lanternfall');
    // The Bastion hasn't started its turns yet, so it still stands: 1 × 2 × 4.
    expect(difficultyNow(w, data, wall)).toBe(8);
    startFactions(w, data);
    expect(difficultyNow(w, data, wall)).toBe(8);
    const bastion = w.factions.bastion;
    if (!bastion) throw new Error('no Bastion');
    // Its headquarters is a base there too: both must go.
    bastion.assets = bastion.assets.filter((a) => a.at !== 'dawnwall');
    expect(difficultyNow(w, data, wall)).toBe(8);
    bastion.bases = bastion.bases.filter((b) => b.at !== 'dawnwall');
    expect(difficultyNow(w, data, wall)).toBe(2);
    bastion.assets = [{ uid: 'b1', asset: 'infantry', at: 'dawnwall', hp: 1 }];
    bastion.hp = 0;
    expect(difficultyNow(w, data, wall)).toBe(2);
  });

  it('falls to the next greatest power, then to none', () => {
    const w = inCinderhold();
    const road = projectOf(data, 'secure-ash-road');
    expect(difficultyNow(w, data, road)).toBe(32);
    startFactions(w, data);
    const host = w.factions.warhost;
    if (!host) throw new Error('no Warhost');
    host.assets = [];
    host.bases = [];
    // The goblin patrols remain (×2), and the tied quest takes a quarter once done.
    expect(difficultyNow(w, data, road)).toBe(8);
    done(w, 'ash-road-relief');
    expect(difficultyNow(w, data, road)).toBe(3);
  });

  it('takes off tied adventures: quests turned in and dungeons cleared', () => {
    const w = inCinderhold();
    const cisterns = projectOf(data, 'cinderhold-cisterns');
    expect(adventuresDone(w, data, cisterns)).toBe(0);
    const d = data.content.dungeons.find((x) => x.id === 'drowned-cisterns');
    for (const l of d?.levels ?? [])
      for (const s of l.specials)
        if (s.kind === 'cache') w.caches.push(`drowned-cisterns/${l.id}/${s.at.x},${s.at.y}`);
    expect(adventuresDone(w, data, cisterns)).toBe(25);
    expect(adventuresDone(w, data, projectOf(data, 'wall-mirewatch'))).toBe(0);
    done(w, 'cistern-hydra');
    expect(adventuresDone(w, data, projectOf(data, 'wall-mirewatch'))).toBe(25);
    // A dungeon with no caches is never cleared, nor one that isn't there.
    expect(hasCome(w, data, { kind: 'dungeon', dungeon: 'grisks-hold' })).toBe(false);
    expect(hasCome(w, data, { kind: 'dungeon', dungeon: 'atlantis' })).toBe(false);
    // A faction that hasn't started holds its ground.
    expect(hasCome(w, data, { kind: 'faction-gone', faction: 'atlantis', at: 'dawnwall' })).toBe(
      false,
    );
  });
});

describe('working on projects (Sam’s calls: any settlement on its map, finished at once)', () => {
  it('works only from a settlement on the project’s own map, until it is finished', () => {
    const w = inCinderhold();
    const wall = projectOf(data, 'wall-lanternfall');
    expect(cannotWork(w, data, wall)).toBeNull();
    expect(cannotWork(w, data, projectOf(data, 'secure-west-road'))).toBe(
      'Secure the West Road is worked from a settlement on its own map.',
    );
    w.position = { col: 7, row: 12 };
    expect(cannotWork(w, data, wall)).toBe('Projects are worked from a settlement.');
    w.position = { col: 6, row: 12 };
    w.majorProjects[wall.id] = {
      renown: 8,
      bought: 0,
      done: 3,
      daysLeft: null,
      help: [],
      trouble: null,
      shutUntil: null,
      specialist: null,
    };
    expect(cannotWork(w, data, wall)).toBe('Wall Lanternfall is finished.');
    expect(spendRenown(w, data, wall.id, 1)).toEqual({
      ok: false,
      reason: 'Wall Lanternfall is finished.',
    });
    expect(buyRenown(w, data, wall.id, 1)).toEqual({
      ok: false,
      reason: 'Wall Lanternfall is finished.',
    });
    expect(() => projectOf(data, 'atlantis')).toThrow('unknown project atlantis');
  });

  it('puts Renown in, no more than it needs, and finishes the project the moment it is covered', () => {
    const w = inCinderhold();
    const drains = projectOf(data, 'mirewatch-drains');
    expect(spendRenown(w, data, 'end-grisks-tithe', 1)).toEqual({
      ok: false,
      reason: 'The party has no Renown to put in.',
    });
    w.renown = 10;
    expect(spendRenown(w, data, 'end-grisks-tithe', 3)).toEqual({ ok: true });
    expect(progressOf(w, 'end-grisks-tithe')).toMatchObject({ renown: 3, bought: 0, done: null });
    expect(w.renown).toBe(7);
    // The drains need building work (Phase 22b): covered, but not yet done.
    expect(spendRenown(w, data, drains.id, 5)).toEqual({ ok: true });
    expect(progressOf(w, drains.id)).toMatchObject({ renown: 2, bought: 0, done: null });
    expect(spendRenown(w, data, drains.id, 1)).toEqual({
      ok: false,
      reason: 'Drain the Mirewatch Fields has all the Renown it needs.',
    });
    expect(buyRenown(w, data, drains.id, 1)).toEqual({
      ok: false,
      reason: 'Drain the Mirewatch Fields has all the Renown it needs.',
    });
    // The Salt Tithe isn't on this map; Grisk's needs no building, so it finishes once covered.
    startFactions(w, data);
    done(w, 'warlord-falls');
    Object.assign(w.factions.warhost as object, { assets: [], bases: [] });
    expect(difficultyNow(w, data, projectOf(data, 'end-grisks-tithe'))).toBe(16);
    w.renown = 20;
    expect(spendRenown(w, data, 'end-grisks-tithe', 20)).toEqual({ ok: true });
    expect(w.renown).toBe(7);
    expect(progressOf(w, 'end-grisks-tithe').done).toBe(w.day);
    expect(w.log.at(-1)).toContain("End Grisk's Tithe is done. The Dark Lands pay no tithe");
  });

  it('buys Renown with crowns, band by band, until the table runs out', () => {
    const w = inCinderhold();
    w.purse = 50;
    expect(buyPrice(w, data, 'end-grisks-tithe', 5)).toBe(80);
    expect(buyRenown(w, data, 'end-grisks-tithe', 5)).toEqual({
      ok: false,
      reason: 'That costs 80 crowns.',
    });
    expect(buyRenown(w, data, 'end-grisks-tithe', 4)).toEqual({ ok: true });
    expect(w.purse).toBe(10);
    expect(progressOf(w, 'end-grisks-tithe')).toMatchObject({ renown: 4, bought: 4, done: null });
    expect(w.log.at(-1)).toContain("40 crowns on End Grisk's Tithe: 4 Renown");
    // Past the table, more is not for sale.
    w.majorProjects['end-grisks-tithe'] = {
      renown: 4,
      bought: 128,
      done: null,
      daysLeft: null,
      help: [],
      trouble: null,
      shutUntil: null,
      specialist: null,
    };
    expect(buyRenown(w, data, 'end-grisks-tithe', 1)).toEqual({
      ok: false,
      reason: 'No more Renown can be bought for it.',
    });
  });

  it('finishes a covered project when its opposition falls later', () => {
    const w = world();
    enterRegion(w, 'borderlands', { col: 3, row: 8 });
    w.position = { col: 3, row: 8 };
    w.renown = 4;
    expect(spendRenown(w, data, 'secure-west-road', 4)).toEqual({ ok: true });
    expect(progressOf(w, 'secure-west-road').done).toBeNull();
    // Breaking the raiders drops it to 4, and the Raider Camp's share to 3: covered at once.
    done(w, 'bandit-camp');
    emit(w, data, { kind: 'quest-done', quest: 'bandit-camp' });
    expect(progressOf(w, 'secure-west-road').done).toBe(w.day);
    expect(w.log.at(-1)).toContain('Secure the West Road is done.');
  });
});
