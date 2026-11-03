import { describe, expect, it } from 'vitest';
import {
  notesChoices,
  orderChoices,
  raidedText,
  sealOpen,
  settingNotes,
} from '../../src/render/setting-view.ts';
import { data, encounter, siege, world } from '../game/world/helpers.ts';

describe('setting view (Phase 12b)', () => {
  it('lists sieges, sackings, countersigns, and tokens', () => {
    const w = world();
    expect(settingNotes(w, data)).toEqual([]);
    w.sieges = [siege({ town: 'cinderhold', next: 36 })];
    w.raided = { gutterwick: 40, mirewatch: 2, lost: 50 };
    w.day = 10;
    w.countersigns = ['ruinfield-gate', 'ash-road-patrol'];
    w.ordersEnded = ['ruinfield-gate'];
    w.authority = ['lieutenants-token', 'gone'];
    expect(settingNotes(w, data)).toEqual([
      "Grisk's Warhost besieges Cinderhold, held by The Free Settlements, with 0 camps: the next assault comes at the end of day 37.",
      'Gutterwick was sacked: prices are up until day 41.',
      'lost was sacked: prices are up until day 51.',
      'Countersign for Hold the Ruinfield Gate: "The ash remembers" (ended)',
      'Countersign for Patrol the Ash Road: "Iron and salt"',
      "Carrying A Lieutenant's Token.",
    ]);
    expect(raidedText(w, 'gutterwick')).toBe('Sacked: prices up');
    expect(raidedText(w, 'mirewatch')).toBeNull();
  });

  it('offers what the party can do about a standing order', () => {
    const w = world();
    expect(orderChoices(w, data)).toBeNull();
    w.encounter = encounter([['bound-orc-guard']], { order: 'ruinfield-gate' });
    expect(orderChoices(w, data)).toEqual({
      name: 'Hold the Ruinfield Gate',
      countersign: false,
      authority: null,
      bluff: true,
    });
    w.countersigns = ['ruinfield-gate'];
    w.authority = ['seal-of-command'];
    w.encounter.parleyed = true;
    expect(orderChoices(w, data)).toEqual({
      name: 'Hold the Ruinfield Gate',
      countersign: true,
      authority: 'The Seal of Command',
      bluff: false,
    });
  });

  it('shows the clock, the ending, and the notes and seal choices (Phase 12d)', () => {
    const w = world();
    w.clock = 3;
    expect(settingNotes(w, data)).toEqual([
      "The warlord's clock: 3 of 6. Every 2 segments, bolder patrols.",
    ]);
    w.ending = 'give';
    expect(settingNotes(w, data)[0]).toContain('Elder Gorvash takes the seal');
    w.notes = { 'vats-notes': 'found', 'grisk-notes': 'sold' };
    expect(notesChoices(w, data, false)).toEqual([
      { id: 'vats-notes', name: "the vat-master's notes", canSell: false },
    ]);
    expect(sealOpen(w, data, 'elder-gorvash', 'cinderhold')).toBe(false);
    w.ending = null;
    w.quests['warlord-falls'] = { status: 'done', step: 2, acceptedDay: 0 };
    w.authority = ['seal-of-command'];
    expect(sealOpen(w, data, 'elder-gorvash', 'cinderhold')).toBe(true);
    expect(sealOpen(w, data, 'foreman-tikka', 'cinderhold')).toBe(false);
  });
});
