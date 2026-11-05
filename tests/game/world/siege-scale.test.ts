import { describe, expect, it } from 'vitest';
import { emit } from '../../../src/game/world/bus.ts';
import { levelExtra, scaledRows } from '../../../src/game/world/siege-scale.ts';
import { data } from './helpers.ts';
import { besieged, unscaled, warbandOnly } from './siege-helpers.ts';

const at = (levelScale: number) => ({
  ...data,
  content: { ...data.content, siegeRules: { ...data.content.siegeRules, levelScale } },
});

describe('siege fights scaled to the party (docs/rules-adaptation.md, Sieges; Phase 23h)', () => {
  it('adds fighters per level of the party, rounded down', () => {
    const { w } = besieged();
    // The starters are level 1.
    expect(levelExtra(w, at(2))).toBe(2);
    expect(levelExtra(w, at(1.5))).toBe(1);
    expect(levelExtra(w, unscaled)).toBe(0);
  });

  it('draws the extra fighters from the group’s own monsters, in rows of eight', () => {
    const { w } = besieged();
    const band = [['t', 't', 't'], ['p']];
    expect(scaledRows(w, unscaled, band)).toEqual(band);
    // Three more, drawn in turn from the warband's own: they line up beside its front row.
    expect(scaledRows(w, at(3), band)).toEqual([['t', 't', 't', 't', 't', 't'], ['p']]);
    expect(scaledRows(w, at(2), [])).toEqual([]);
    // Never more than three rows of eight.
    expect(scaledRows(w, at(40), band).flat()).toHaveLength(24);
  });

  it('brings the extras to the party’s share of an assault', () => {
    const { w, s } = besieged();
    warbandOnly(w);
    s.next = w.day;
    emit(w, at(2), { kind: 'day-passed' });
    // The warband's 4, and 2 more for a level-1 party.
    expect(w.encounter?.enemies.flat()).toHaveLength(6);
  });
});
