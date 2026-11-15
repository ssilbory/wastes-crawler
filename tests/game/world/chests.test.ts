import { describe, expect, it } from 'vitest';
import type { ChestState, Ruin } from '../../../src/data/schemas/index.ts';
import {
  chestHere,
  chestLevel,
  disarmChest,
  gearBonus,
  handFor,
  lockCache,
  lockSpoils,
  openChest,
} from '../../../src/game/world/chests.ts';
import { enterDungeon } from '../../../src/game/dungeon/explore.ts';
import { checkBonus } from '../../../src/game/world/members.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { createRng, type Rng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { data, world } from './helpers.ts';

/** Scripted faces first, then a seeded RNG for whatever follows (loot, drops). */
function faces(list: number[]): Rng {
  const head = scriptedRng(list);
  const rest = createRng('chests');
  return {
    next: () => rest.next(),
    int: (min, max) => (head.remaining() > 0 ? head.int(min, max) : rest.int(min, max)),
  } as Rng;
}

const THUGS = [['thug-or-militia']];
const rules = data.content.chests;

/** The party with a boss chest at its feet: trap 0 drawn, and the look rolled from `look`. */
function withChest(look: [number, number]): World {
  const w = world();
  w.rng = faces([0, ...look]);
  lockSpoils(w, data, THUGS, 1, null);
  return w;
}

const give = (m: Member, id: string) => {
  m.character = {
    ...m.character,
    inventory: [...m.character.inventory, { id, quantity: 1, location: 'stowed' }],
  };
};
const strip = (w: World, id: string) => {
  for (const m of w.members)
    m.character = {
      ...m.character,
      inventory: m.character.inventory.filter((e) => e.id !== id),
    };
};

describe('locked boss chests (docs/rules-adaptation.md, Locks and chests)', () => {
  it('lock a boss’s drop where it fell, with a trap drawn for its level', () => {
    const w = withChest([1, 1]);
    const c = chestHere(w) as ChestState;
    expect(c).toMatchObject({
      vault: false,
      difficulty: 7,
      trap: rules.traps[0],
      trapState: 'hidden',
      looked: true,
      spoils: { enemies: THUGS, xp: 1 },
      cache: null,
    });
    expect(w.log.join('\n')).toContain('The boss leaves a locked chest.');
    // Elsewhere there is nothing locked.
    w.position = { col: w.position.col + 1, row: w.position.row };
    expect(chestHere(w)).toBeUndefined();
  });

  it('spot the trap on a good look', () => {
    const w = withChest([6, 6]);
    expect(chestHere(w)?.trapState).toBe('noticed');
    expect(w.log.at(-1)).toContain(`spots a ${rules.traps[0]?.name} on the chest`);
  });

  it('set the level by shipped ruin, then quest, then the guards’ hit dice', () => {
    const w = world();
    expect(chestLevel(w, data, null, [])).toBe(1);
    expect(chestLevel(w, data, null, [['thug-or-militia', 'knight-or-minor-hero']])).toBe(4);
    const quest = data.content.quests.find((q) => q.prerequisites.minLevel > 1);
    if (!quest) throw new Error('no quest');
    expect(chestLevel(w, data, quest.id, THUGS)).toBe(quest.prerequisites.minLevel);
    const ruin = data.content.ruins.find((r) => r.level >= 3) as Ruin;
    enterRegion(w, ruin.region, ruin);
    enterDungeon(w, data);
    expect(chestLevel(w, data, quest.id, THUGS)).toBe(ruin.level);
  });

  it('add a cache to the chest already here, as a vault', () => {
    const w = withChest([1, 1]);
    lockCache(w, data, 'd/l/1,1', true, THUGS);
    expect(w.chests).toHaveLength(1);
    expect(chestHere(w)).toMatchObject({ vault: true, cache: 'd/l/1,1', spoils: { xp: 1 } });
  });

  it('pick at -2 without Criminal Tools, and force at +1 with a crowbar', () => {
    const w = world();
    strip(w, rules.tools.item);
    strip(w, rules.crowbar.item);
    expect(gearBonus(w, data, 'pick')).toBe(-2);
    expect(gearBonus(w, data, 'disarm')).toBe(-2);
    expect(gearBonus(w, data, 'force')).toBe(0);
    give(w.members[3] as Member, rules.tools.item);
    give(w.members[0] as Member, rules.crowbar.item);
    expect(gearBonus(w, data, 'pick')).toBe(0);
    expect(gearBonus(w, data, 'force')).toBe(1);
  });

  it('open a picked lock without springing its trap, and pay out the drop', () => {
    const w = withChest([1, 1]);
    w.loot = [];
    w.rng = faces([6, 6]);
    expect(openChest(w, data, 'pick')).toEqual({ ok: true });
    expect(w.chests).toEqual([]);
    expect(w.log.join('\n')).not.toContain('springs');
    expect(w.log.join('\n')).toContain("picks the chest's lock");
    expect(w.loot.length).toBeGreaterThan(0);
  });

  it('spring the trap when a pick misses by 2 or more, and only once', () => {
    const w = withChest([1, 1]);
    for (const m of w.members) m.character.hp = { ...m.character.hp, current: 99, max: 99 };
    // 1 + 1 misses 7 by far; each PC fails its save.
    w.rng = faces([1, 1, 20, 20, 20, 20]);
    openChest(w, data, 'pick');
    expect(chestHere(w)?.trapState).toBe('sprung');
    expect(w.log.join('\n')).toContain(`The ${rules.traps[0]?.name} springs!`);
    // A spent trap springs no more.
    const before = w.log.length;
    w.rng = faces([1, 1]);
    openChest(w, data, 'pick');
    expect(w.log.slice(before).join('\n')).not.toContain('springs');
    expect(chestHere(w)).toBeDefined();
  });

  it('always spring a set trap when forcing', () => {
    const w = withChest([1, 1]);
    for (const m of w.members) m.character.hp = { ...m.character.hp, current: 99, max: 99 };
    w.rng = faces([6, 6, 20, 20, 20, 20]);
    openChest(w, data, 'force');
    expect(w.log.join('\n')).toContain('forces the chest open');
    expect(w.log.join('\n')).toContain('springs!');
    expect(w.chests).toEqual([]);
  });

  it('disarm a spotted trap, after which forcing is safe', () => {
    const w = withChest([6, 6]);
    w.rng = faces([6, 6]);
    expect(disarmChest(w, data)).toEqual({ ok: true });
    expect(chestHere(w)?.trapState).toBe('disarmed');
    w.rng = faces([6, 6]);
    openChest(w, data, 'force');
    expect(w.log.join('\n')).not.toContain('springs');
  });

  it('spring a trap fumbled by 2 or more, and leave it on a near miss', () => {
    const w = withChest([6, 6]);
    const c = chestHere(w) as ChestState;
    c.difficulty = 20;
    for (const m of w.members) m.character.hp = { ...m.character.hp, current: 99, max: 99 };
    w.rng = faces([1, 1, 20, 20, 20, 20]);
    disarmChest(w, data);
    expect(c.trapState).toBe('sprung');
    c.trapState = 'noticed';
    // Double sixes fall one short of the difficulty: a near miss.
    const hand = handFor(w, data, 'disarm') as Member;
    c.difficulty = 13 + checkBonus(data, hand, 'sneak', ['dex']) + gearBonus(w, data, 'disarm');
    const before = w.log.length;
    w.rng = faces([6, 6]);
    disarmChest(w, data);
    expect(c.trapState).toBe('noticed');
    expect(w.log.slice(before).join('\n')).toContain("can't work out");
  });

  it('refuse a disarm with no trap found, nothing here, or an encounter pending', () => {
    const w = withChest([1, 1]);
    expect(disarmChest(w, data)).toEqual({ ok: false, reason: 'No trap has been found on it.' });
    w.encounter = { enemies: [] } as unknown as World['encounter'];
    expect(openChest(w, data, 'pick')).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    w.encounter = null;
    w.chests = [];
    expect(openChest(w, data, 'force')).toEqual({
      ok: false,
      reason: 'There is nothing locked here.',
    });
  });
});

describe('saves with chests (version 56)', () => {
  it('starts with none locked anywhere', () => {
    const up = WORLD_MIGRATIONS[55] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 55 })).toEqual({ schemaVersion: 56, chests: [] });
  });

  it('keeps a locked chest through a save', () => {
    const w = withChest([6, 6]);
    w.rng = createRng('save');
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.chests).toEqual(w.chests);
    expect(back.world.chests).toHaveLength(1);
  });
});
