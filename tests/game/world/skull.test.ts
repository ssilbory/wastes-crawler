import { describe, expect, it } from 'vitest';
import { leaveCorpses } from '../../../src/game/world/necromancy.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { LAND_RADIUS, queryTheSkull, skullQuestions } from '../../../src/game/world/skull.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { distance, parseHexKey } from '../../../src/rules/hex.ts';
import { below, place, state } from '../dungeon/helpers.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Fizzwick as a level-`level` Necromancer with Query the Skull prepared. */
function necromancer(w: World, level = 2): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-necromancer', levels: { 'full-necromancer': level } },
    spells: { known: ['query-the-skull'], prepared: ['query-the-skull'] },
    arts: ['bonetalker'],
  };
  return m;
}

const fail = (reason: string) => ({ ok: false, reason });

describe('Query the Skull', () => {
  it('maps the level, names its traps, and finds its secret doors underground', () => {
    const w = below();
    const m = necromancer(w, 3);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(skullQuestions(w)).toEqual(['map', 'traps', 'secrets', 'boss', 'vault', 'hoard']);
    const s = state(w);
    s.traps['barrow-upper'] = { '9,9': 'disarmed' };
    expect(queryTheSkull(w, data, m.id, ['map', 'traps', 'secrets'])).toEqual({ ok: true });
    expect(s.seen['barrow-upper']).toHaveLength(100);
    expect(s.traps['barrow-upper']).toEqual({ '9,9': 'disarmed', '4,6': 'noticed' });
    expect(s.found['barrow-upper']).toEqual(['4,1,w']);
    expect(m.spellsCast).toBe(1);
    expect(w.corpses?.queried).toBe(true);
    expect(w.log.slice(-4).map((l) => l.replace(/^Day \d+, \w+: /, ''))).toEqual([
      'Fizzwick questions the dead.',
      'The dead recall every passage of this level.',
      'The dead name every snare on this level.',
      'The dead tell of every hidden door on this level.',
    ]);
  });

  it('maps a level the party has seen nothing of', () => {
    const w = place(below(), 'barrow-lower', 0, 0, 's');
    delete state(w).seen['barrow-lower'];
    const m = necromancer(w);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(queryTheSkull(w, data, m.id, ['map'])).toEqual({ ok: true });
    expect(state(w).seen['barrow-lower']).toHaveLength(64);
  });

  it('leaves a disarmed trap disarmed and a found door found', () => {
    const w = below();
    const m = necromancer(w);
    leaveCorpses(w, data, [['thug-or-militia']]);
    const s = state(w);
    s.traps['barrow-upper'] = { '4,6': 'disarmed' };
    s.found['barrow-upper'] = ['4,1,w'];
    expect(queryTheSkull(w, data, m.id, ['traps', 'secrets'])).toEqual({ ok: true });
    expect(s.traps['barrow-upper']).toEqual({ '4,6': 'disarmed' });
    expect(s.found['barrow-upper']).toEqual(['4,1,w']);
  });

  it('describes the land within reach above ground', () => {
    const w = world();
    const m = necromancer(w, 1);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(skullQuestions(w)).toEqual(['land']);
    const before = new Set(w.visited);
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual({ ok: true });
    const added = [...w.visited].filter((k) => !before.has(k));
    expect(added.length).toBeGreaterThan(0);
    expect(added.every((k) => distance(w.position, parseHexKey(k)) <= LAND_RADIUS)).toBe(true);
    expect(w.visited.has('6,8')).toBe(true);
    expect(w.visited.has('7,8')).toBe(false);
  });

  it('answers no more than one question per caster level, and only those open here', () => {
    const w = below();
    const m = necromancer(w, 1);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(queryTheSkull(w, data, m.id, ['map', 'traps'])).toEqual(
      fail('Fizzwick can ask no more than 1 question.'),
    );
    m.character.classes.levels['full-necromancer'] = 2;
    expect(queryTheSkull(w, data, m.id, ['map', 'traps', 'secrets'])).toEqual(
      fail('Fizzwick can ask no more than 2 questions.'),
    );
    expect(queryTheSkull(w, data, m.id, ['map', 'traps', 'map'])).toEqual({ ok: true });
    const up = world();
    const n = necromancer(up);
    leaveCorpses(up, data, [['thug-or-militia']]);
    expect(queryTheSkull(up, data, n.id, ['map'])).toEqual(
      fail('Ask the dead something they can answer here.'),
    );
    expect(queryTheSkull(up, data, n.id, [])).toEqual(
      fail('Ask the dead something they can answer here.'),
    );
    expect(n.spellsCast).toBe(0);
  });

  it('needs fresh corpses here, never questioned before', () => {
    const w = world();
    const m = necromancer(w, 2);
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual(fail('There are no corpses here.'));
    leaveCorpses(w, data, [['thug-or-militia']]);
    w.day = 3;
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual(
      fail('These dead are too long gone to answer.'),
    );
    w.day = 2;
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual({ ok: true });
    m.spellsCast = 0;
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual(fail('These dead have already spoken.'));
    w.position = { col: 4, row: 8 };
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual(fail('There are no corpses here.'));
  });

  it('is refused in an encounter, unprepared, or with no spells left', () => {
    const w = world();
    const m = necromancer(w);
    leaveCorpses(w, data, [['thug-or-militia']]);
    w.encounter = encounter([['thug-or-militia']]);
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual(fail('Settle the encounter first.'));
    w.encounter = null;
    m.spellsCast = 9;
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual(
      fail('Fizzwick has no spells left today.'),
    );
    m.character.spells.prepared = [];
    expect(queryTheSkull(w, data, m.id, ['land'])).toEqual(
      fail("Fizzwick hasn't prepared Query the Skull."),
    );
  });
});

describe('world save version 27', () => {
  it('loads corpses as fallen today and not yet questioned', () => {
    const w = world();
    w.day = 4;
    leaveCorpses(w, data, [['thug-or-militia']]);
    const save = JSON.parse(serializeWorld(w));
    const old = { at: save.corpses.at, hitDice: save.corpses.hitDice };
    for (const corpses of [old, null]) {
      const loaded = parseWorld(JSON.stringify({ ...save, schemaVersion: 27, corpses }), data);
      if (!loaded.ok) throw new Error(loaded.errors.join('; '));
      expect(loaded.world.corpses).toEqual(corpses && { ...old, day: 4, queried: false });
      expect(loaded.world).toMatchObject({ disguise: null, palanquin: null });
    }
  });

  it('loads a dungeon with no arcane sight and nothing sensed', () => {
    const save = JSON.parse(serializeWorld(below()));
    const without = (o: Record<string, unknown>, keys: string[]) =>
      Object.fromEntries(Object.entries(o).filter(([k]) => !keys.includes(k)));
    const v27 = {
      ...without(save, ['disguise', 'palanquin']),
      schemaVersion: 27,
      dungeon: without(save.dungeon, ['sight', 'sensed']),
    };
    const loaded = parseWorld(JSON.stringify(v27), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    expect(loaded.world.dungeon).toMatchObject({ sight: null, sensed: {} });
  });
});
