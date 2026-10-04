import { describe, expect, it } from 'vitest';
import {
  addStarterParty,
  addToRoster,
  parseRoster,
  removeFromRoster,
  serializeRoster,
  setDefaultAction,
} from '../../src/game/character/roster.ts';
import { data, starter } from './combat/helpers.ts';

describe('the character roster', () => {
  it('round-trips through storage text', () => {
    const entries = addToRoster(addToRoster([], starter('snag')), starter('grukk'));
    const loaded = parseRoster(serializeRoster(entries), data);
    expect(loaded.errors).toEqual([]);
    expect(loaded.entries.map((e) => [e.id, e.character.name, e.defaultAction])).toEqual([
      ['snag', 'Snag', 'auto'],
      ['grukk', 'Grukk', 'auto'],
    ]);
  });

  it('treats a missing roster as empty, and reports unreadable ones', () => {
    expect(parseRoster(null, data)).toEqual({ entries: [], errors: [] });
    expect(parseRoster('{', data).errors).toEqual(['the saved roster is not valid JSON']);
    expect(parseRoster('{"version":2,"entries":[]}', data).errors).toEqual([
      'the saved roster is damaged',
    ]);
  });

  it('drops characters that no longer load, and says why', () => {
    const text = JSON.stringify({
      version: 1,
      entries: [
        { id: 'snag', defaultAction: 'defend', character: starter('snag') },
        { id: 'ghost', defaultAction: 'auto', character: { schemaVersion: 99 } },
      ],
    });
    const loaded = parseRoster(text, data);
    expect(loaded.entries.map((e) => [e.id, e.defaultAction])).toEqual([['snag', 'defend']]);
    expect(loaded.errors).toEqual(['ghost: made by a newer version of the game (schema 99)']);
  });

  it('gives each character a unique id, and removes and updates by id', () => {
    const snag = starter('snag');
    let entries = addToRoster([], snag);
    entries = addToRoster(entries, snag);
    entries = addToRoster(entries, snag);
    entries = addToRoster(entries, { ...snag, name: '  ' });
    expect(entries.map((e) => e.id)).toEqual(['snag', 'snag-2', 'snag-3', 'character']);
    entries = setDefaultAction(entries, 'snag-2', 'repeat');
    expect(entries.map((e) => e.defaultAction)).toEqual(['auto', 'repeat', 'auto', 'auto']);
    expect(removeFromRoster(entries, 'snag').map((e) => e.id)).toEqual([
      'snag-2',
      'snag-3',
      'character',
    ]);
  });
});

describe('the starter party', () => {
  it('joins the roster once, placed in its formation slots', () => {
    const first = addStarterParty([], data);
    expect(first.entries.map((e) => e.character.name)).toEqual([
      'Snag',
      'Grukk',
      'Lirael',
      'Fizzwick',
    ]);
    expect(first.placement).toEqual({
      '0-0': 'snag',
      '0-1': 'grukk',
      '1-0': 'lirael',
      '1-1': 'fizzwick',
    });
    // Added again, after a round trip through storage, nothing is duplicated.
    const stored = parseRoster(serializeRoster(first.entries), data).entries;
    const again = addStarterParty(stored, data);
    expect(again.entries).toHaveLength(4);
    expect(again.placement).toEqual(first.placement);
  });

  it('refuses a starter that no longer imports', () => {
    const [snag] = data.content.starterParty;
    if (!snag) throw new Error('missing starter');
    const broken = {
      ...data,
      content: {
        ...data.content,
        starterParty: [{ ...snag, character: { ...snag.character, people: 'dwarf' } }],
      },
    };
    expect(() => addStarterParty([], broken)).toThrow(/^starter Snag: /);
  });
});
