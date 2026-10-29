import { describe, expect, it } from 'vitest';
import type { Ruin, Special } from '../../../src/data/schemas/index.ts';
import { enterDungeon } from '../../../src/game/dungeon/explore.ts';
import { dungeonOf } from '../../../src/game/dungeon/levels.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { leaveCorpses } from '../../../src/game/world/necromancy.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import { bossCache, isLocate, locatedMarks, wayTo } from '../../../src/game/world/skull-locate.ts';
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
const marks = (w: World) => state(w).located['buried-waterworks-1'];
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
    expect(marks(w)).toEqual({ '1,0': 'boss' });
  });

  it('says when the boss has already fallen, marking nothing', () => {
    const { w, m } = waterworks();
    w.beaten.push('buried-waterworks/buried-waterworks-1/1,0');
    expect(queryTheSkull(w, data, m.id, ['boss'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe("The dead say this level's boss has already fallen.");
    expect(marks(w)).toBeUndefined();
  });

  it('knows of no boss on a level without guarded hoards', () => {
    const w = below();
    const m = necromancer(w);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(queryTheSkull(w, data, m.id, ['boss'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe('The dead know of no boss on this level.');
  });

  it('counts a boss whose hoard is taken, or whose order has ended, as fallen', () => {
    const { w, m } = waterworks();
    w.caches.push('buried-waterworks/buried-waterworks-1/1,0');
    expect(queryTheSkull(w, data, m.id, ['boss'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe("The dead say this level's boss has already fallen.");
    const tower = below();
    Object.assign(state(tower), { dungeon: 'harrowmere' });
    place(tower, 'hm-tower-6', 3, 4, 'n');
    const n = necromancer(tower);
    leaveCorpses(tower, data, [['thug-or-militia']]);
    expect(queryTheSkull(tower, data, n.id, ['boss'])).toEqual({ ok: true });
    expect(lastNote(tower)).toBe("The dead say this level's boss waits 2 squares north.");
    tower.ordersEnded.push('warden-seal');
    tower.corpses = { ...(tower.corpses as NonNullable<World['corpses']>), queried: false };
    n.spellsCast = 0;
    expect(queryTheSkull(tower, data, n.id, ['boss'])).toEqual({ ok: true });
    expect(lastNote(tower)).toBe("The dead say this level's boss has already fallen.");
  });

  it('names the nearest hoard wherever it comes in the level', () => {
    const { w, m } = waterworks();
    place(w, 'buried-waterworks-1', 8, 3, 'n');
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(queryTheSkull(w, data, m.id, ['hoard'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe('The dead tell of 2 hoards on this level, the nearest 1 square east.');
  });

  it('marks every hoard left and names the nearest', () => {
    const { w, m } = waterworks();
    expect(queryTheSkull(w, data, m.id, ['hoard'])).toEqual({ ok: true });
    expect(lastNote(w)).toBe(
      'The dead tell of 2 hoards on this level, the nearest 2 squares north and 3 west.',
    );
    expect(marks(w)).toEqual({ '1,0': 'hoard', '9,3': 'hoard' });
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
    expect(s.located[s.level]).toEqual({ [`${vault.at.x},${vault.at.y}`]: 'vault' });
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

describe('locatedMarks', () => {
  /** Asks again over fresh corpses, with the spell not yet cast today. */
  const ask = (w: World, m: Member, q: 'boss' | 'hoard') => {
    w.corpses = { ...(w.corpses as NonNullable<World['corpses']>), queried: false };
    m.spellsCast = 0;
    expect(queryTheSkull(w, data, m.id, [q])).toEqual({ ok: true });
  };

  it('keeps the weightier mark on a square named twice', () => {
    const { w, m } = waterworks();
    ask(w, m, 'hoard');
    ask(w, m, 'boss');
    expect(marks(w)).toEqual({ '1,0': 'boss', '9,3': 'hoard' });
    ask(w, m, 'hoard');
    expect(marks(w)).toEqual({ '1,0': 'boss', '9,3': 'hoard' });
  });

  it('draws marks until the hoard is taken, and a beaten boss as its hoard', () => {
    const { w, m } = waterworks();
    ask(w, m, 'hoard');
    ask(w, m, 'boss');
    expect(locatedMarks(w, data)).toEqual([
      { key: '1,0', x: 1, y: 0, what: 'boss' },
      { key: '9,3', x: 9, y: 3, what: 'hoard' },
    ]);
    w.beaten.push('buried-waterworks/buried-waterworks-1/1,0');
    w.caches.push('buried-waterworks/buried-waterworks-1/9,3');
    expect(locatedMarks(w, data)).toEqual([{ key: '1,0', x: 1, y: 0, what: 'hoard' }]);
    w.caches.push('buried-waterworks/buried-waterworks-1/1,0');
    expect(locatedMarks(w, data)).toEqual([]);
  });

  it('has none above ground or on a level never asked of', () => {
    expect(locatedMarks(world(), data)).toEqual([]);
    expect(locatedMarks(below(), data)).toEqual([]);
  });

  it('gives older saves nothing located, underground or charted', () => {
    const up = WORLD_MIGRATIONS[48] as (raw: Record<string, unknown>) => Record<string, unknown>;
    expect(up({ schemaVersion: 48, dungeon: { seen: {} }, charted: { a: { seen: {} } } })).toEqual({
      schemaVersion: 49,
      dungeon: { seen: {}, located: {} },
      charted: { a: { seen: {}, located: {} } },
    });
    expect(up({ schemaVersion: 48, dungeon: null, charted: {} })).toMatchObject({ dungeon: null });
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
