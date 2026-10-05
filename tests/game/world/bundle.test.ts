import { describe, expect, it } from 'vitest';
import { search } from '../../../src/game/dungeon/secrets.ts';
import { step, turnParty } from '../../../src/game/dungeon/explore.ts';
import type { RosterEntry } from '../../../src/game/character/roster.ts';
import { mergeRoster, parseSave, serializeBundle } from '../../../src/game/world/bundle.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { World } from '../../../src/game/world/types.ts';
import { slotSummary } from '../../../src/render/save-view.ts';
import { below } from '../dungeon/helpers.ts';
import { data, world } from './helpers.ts';

const roster = (w: World): RosterEntry[] =>
  w.members.map((m) => ({ id: m.character.id, character: m.character, defaultAction: 'auto' }));

describe('full game saves (docs/plan.md, Phase 11)', () => {
  it('carry the world and the roster in one file', () => {
    const w = world();
    const text = serializeBundle(w, roster(w).slice(0, 2));
    expect(JSON.parse(text)).toMatchObject({ kind: 'wastes-crawler-save', version: 1 });
    const back = parseSave(text, data);
    expect(back.ok && serializeWorld(back.world)).toBe(serializeWorld(w));
    expect(back.ok && back.roster?.map((e) => e.character.name)).toEqual(['Snag', 'Grukk']);
  });

  it('still load a plain world save, with no roster', () => {
    const w = world();
    const back = parseSave(serializeWorld(w), data);
    expect(back.ok && back.roster).toBeNull();
    expect(parseSave('{', data)).toEqual({ ok: false, errors: ['not valid JSON'] });
    expect(parseSave('null', data)).toMatchObject({ ok: false });
  });

  it('refuse a damaged file, world, or roster', () => {
    const w = world();
    const good = JSON.parse(serializeBundle(w, roster(w)));
    const bad = (change: object) => parseSave(JSON.stringify({ ...good, ...change }), data);
    expect(bad({ version: 2 })).toEqual({ ok: false, errors: ['the save file is damaged'] });
    expect(bad({ world: { schemaVersion: 1 } })).toMatchObject({ ok: false });
    expect(bad({ roster: { version: 99, entries: [] } })).toEqual({
      ok: false,
      errors: ['the saved roster is damaged'],
    });
  });

  it('add a full save’s characters to the roster, replacing any with the same id', () => {
    const w = world();
    const [a, b, c] = roster(w) as [RosterEntry, RosterEntry, RosterEntry];
    const newer = { ...b, defaultAction: 'defend' as const };
    expect(mergeRoster([a, b], [newer, c])).toEqual([a, newer, c]);
  });
});

describe('save slot summaries', () => {
  it('say when, where, and who, or why not', () => {
    const w = world();
    expect(slotSummary(null, data)).toBe('Empty');
    expect(slotSummary('{', data)).toBe('Damaged save');
    expect(slotSummary(serializeWorld(w), data)).toBe(
      'Morning, 1 Seedtime, year 1 (spring) · Rubblegate · Snag, Grukk, Lirael, Fizzwick',
    );
    w.position = { col: 4, row: 8 };
    expect(slotSummary(serializeWorld(w), data)).toContain('the wilds at 4,8');
    expect(slotSummary(serializeWorld(below()), data)).toContain('The Old Barrow');
  });
});

describe('the Phase 11 exit: save mid-dungeon, reload, identical state including RNG', () => {
  it('plays on exactly the same from a reloaded save', () => {
    const w = below();
    for (const dir of ['forward', 'forward', 'forward'] as const) step(w, data, dir);
    turnParty(w, data, 'left');
    const text = serializeWorld(w);
    const loaded = parseWorld(text, data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    const copy = loaded.world;
    expect(serializeWorld(copy)).toBe(text);
    // The same moves from both, searches and wandering checks drawing on the RNG, end the same.
    for (const x of [w, copy]) {
      turnParty(x, data, 'right');
      step(x, data, 'forward');
      search(x, data);
      search(x, data);
    }
    expect(serializeWorld(copy)).toBe(serializeWorld(w));
    expect(copy.rng.next()).toBe(w.rng.next());
  });
});
