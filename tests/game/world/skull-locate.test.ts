import { describe, expect, it } from 'vitest';
import type { Ruin, Special } from '../../../src/data/schemas/index.ts';
import { enterDungeon } from '../../../src/game/dungeon/explore.ts';
import { dungeonOf } from '../../../src/game/dungeon/levels.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { leaveCorpses } from '../../../src/game/world/necromancy.ts';
import { bossCache, isLocate, wayTo } from '../../../src/game/world/skull-locate.ts';
import { queryTheSkull, skullQuestions } from '../../../src/game/world/skull.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { below, place, state } from '../dungeon/helpers.ts';
import { data, member, world } from './helpers.ts';

type Cache = Extract<Special, { kind: 'cache' }>;

/** Fizzwick as a level-`level` Necromancer with Query the Skull prepared. */
function necromancer(w: World, level = 3): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-necromancer', levels: { 'full-necromancer': level } },
    spells: { known: ['query-the-skull'], prepared: ['query-the-skull'] },
    arts: ['bonetalker'],
  };
  return m;
}

/** The party at 4,2 on the Buried Waterworks' first level, over fresh corpses. */
function waterworks(): { w: World; m: Member } {
  const w = below();
  Object.assign(state(w), { dungeon: 'buried-waterworks' });
  place(w, 'buried-waterworks-1', 4, 2, 'n');
  const m = necromancer(w);
  leaveCorpses(w, data, [['thug-or-militia']]);
  return { w, m };
}

const lastNote = (w: World) => (w.log.at(-1) ?? '').replace(/^Day \d+, \w+: /, '');
const seen = (w: World) => state(w).seen['buried-waterworks-1'] ?? [];
const fail = (reason: string) => ({ ok: false, reason });

describe('Query the Skull: locating', () => {
  it('is open below ground only', () => {
    expect(skullQuestions(below())).toEqual(['map', 'traps', 'secrets', 'boss', 'vault', 'hoard']);
    expect(skullQuestions(world())).toEqual(['land']);
    expect(['boss', 'vault', 'hoard'].every(isLocate)).toBe(true);
    expect(isLocate('map')).toBe(false);
  });

  it("names the way to the level's boss and marks its square", () => {
    const { w, m } = waterworks();
    expect(queryTheSkull(w, data, m.id, ['boss'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe("The dead say this level's boss waits 2 squares north and 3 west.");
    expect(seen(w)).toContain('1,0');
    expect(seen(w)).not.toContain('9,3');
  });

  it('says when the boss has already fallen, marking nothing', () => {
    const { w, m } = waterworks();
    w.beaten.push('buried-waterworks/buried-waterworks-1/1,0');
    const before = seen(w).length;
    expect(queryTheSkull(w, data, m.id, ['boss'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe("The dead say this level's boss has already fallen.");
    expect(seen(w)).toHaveLength(before);
  });

  it('marks every hoard left and names the nearest', () => {
    const { w, m } = waterworks();
    expect(queryTheSkull(w, data, m.id, ['hoard'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe(
      'The dead tell of 2 hoards on this level, the nearest 2 squares north and 3 west.',
    );
    expect(seen(w)).toEqual(expect.arrayContaining(['1,0', '9,3']));
  });

  it('leaves out hoards already taken', () => {
    const { w, m } = waterworks();
    w.caches.push('buried-waterworks/buried-waterworks-1/1,0');
    expect(queryTheSkull(w, data, m.id, ['hoard'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe('The dead say a hoard lies 1 square south and 5 east.');
    w.caches.push('buried-waterworks/buried-waterworks-1/9,3');
    w.corpses = { ...(w.corpses as NonNullable<World['corpses']>), queried: false };
    m.spellsCast = 0;
    expect(queryTheSkull(w, data, m.id, ['hoard'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe('The dead know of no hoard left on this level.');
  });

  it('knows of no vault on a level without one', () => {
    const { w, m } = waterworks();
    expect(queryTheSkull(w, data, m.id, ['vault'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe('The dead know of no vault left on this level.');
  });

  it("finds a ruin's vault", () => {
    const chapel = data.content.ruins.find((r) => r.id === 'sunken-chapel') as Ruin;
    const w = world();
    enterRegion(w, chapel.region, chapel);
    enterDungeon(w, data);
    const s = state(w);
    const level = dungeonOf(data, s.dungeon).levels[0] as { specials: Special[] };
    const vault = level.specials.find((x): x is Cache => x.kind === 'cache' && !!x.vault);
    if (!vault) throw new Error('no vault');
    const m = necromancer(w);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(queryTheSkull(w, data, m.id, ['vault'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe(`The dead say the vault lies ${wayTo(s.at, vault.at)}.`);
    expect(s.seen[s.level]).toContain(`${vault.at.x},${vault.at.y}`);
  });

  it('asks only one locating question a casting, beside the others', () => {
    const { w, m } = waterworks();
    expect(queryTheSkull(w, data, m.id, ['boss', 'vault'])).toEqual(
      fail('The dead can locate only one of the boss, the vault, or a hoard.'),
    );
    expect(m.spellsCast).toBe(0);
    expect(queryTheSkull(w, data, m.id, ['map', 'boss', 'traps'])).toEqual({ ok: true });
  });
});

describe('wayTo', () => {
  it('gives the way north up, in squares', () => {
    expect(wayTo({ x: 3, y: 3 }, { x: 3, y: 3 })).toBe('right here');
    expect(wayTo({ x: 0, y: 0 }, { x: 0, y: 1 })).toBe('1 square south');
    expect(wayTo({ x: 0, y: 0 }, { x: 2, y: 0 })).toBe('2 squares east');
    expect(wayTo({ x: 2, y: 0 }, { x: 0, y: 0 })).toBe('2 squares west');
    expect(wayTo({ x: 0, y: 4 }, { x: 1, y: 0 })).toBe('4 squares north and 1 east');
  });
});

describe('bossCache', () => {
  const cache = (o: Partial<Cache>): Cache => ({
    kind: 'cache',
    at: { x: 0, y: 0 },
    loot: [{ count: 1, sides: 6 }],
    ...o,
  });
  const guards = [['thug-or-militia']];

  it('picks a hoard with words of its own, then a vault, then the richest guarded cache', () => {
    const plain = cache({ guards });
    const rich = cache({ guards, loot: [{ count: 3, sides: 6 }] });
    const vault = cache({ guards, vault: true });
    const told = cache({ guards, text: 'The boss rises.' });
    expect(bossCache([plain, rich, vault, told])).toBe(told);
    expect(bossCache([plain, rich, vault])).toBe(vault);
    expect(bossCache([plain, rich])).toBe(rich);
    expect(bossCache([rich, cache({ guards, loot: [{ count: 3, sides: 6 }] })])).toBe(rich);
  });

  it('has none without guards', () => {
    expect(bossCache([cache({}), cache({ text: 'Loose coins.' })])).toBeUndefined();
    expect(bossCache([])).toBeUndefined();
  });
});
