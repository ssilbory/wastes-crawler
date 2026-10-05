import { describe, expect, it } from 'vitest';
import { dateOf, describeDate, quarterName } from '../../../src/game/world/calendar.ts';
import {
  addMemberStrain,
  bestAt,
  checkBonus,
  healNight,
  hurt,
  memberCheck,
  note,
  restQuarter,
} from '../../../src/game/world/members.ts';
import { findPath, regionMap, seenHexes } from '../../../src/game/world/region.ts';
import { hexKey } from '../../../src/rules/hex.ts';
import { data, member, world } from './helpers.ts';

const rules = data.content.overlandRules;

describe('the calendar', () => {
  it('starts on the first of Seedtime and rolls into months and years', () => {
    expect(dateOf(rules, 0)).toEqual({
      year: 1,
      month: 2,
      monthName: 'Seedtime',
      dayOfMonth: 1,
      season: 'spring',
    });
    expect(dateOf(rules, 29)).toMatchObject({ monthName: 'Seedtime', dayOfMonth: 30 });
    expect(dateOf(rules, 30)).toMatchObject({ monthName: 'Blossom', dayOfMonth: 1 });
    expect(dateOf(rules, 300)).toMatchObject({
      year: 2,
      monthName: 'Deepwinter',
      season: 'winter',
    });
    expect(quarterName(3)).toBe('night');
    expect(describeDate(rules, 0, 1)).toBe('Day, 1 Seedtime, year 1 (spring)');
  });
});

describe('the region map', () => {
  const map = regionMap(data, 'borderlands');

  it('reads terrain, danger, sites, and costs', () => {
    expect(map).toMatchObject({ width: 24, height: 18, start: { id: 'westhold' } });
    expect(map.terrainAt({ col: 8, row: 1 }).id).toBe('mountains');
    expect(map.dangerAt({ col: 8, row: 1 })).toBe('dangerous');
    expect(map.dangerAt({ col: 5, row: 8 })).toBe('road');
    expect(map.siteAt({ col: 20, row: 8 })?.name).toBe('Scrapmarch');
    expect(map.siteAt({ col: 0, row: 0 })).toBeUndefined();
    expect(map.costOf({ col: 0, row: 0 })).toBe(2);
    expect(map.costOf({ col: 0, row: 8 })).toBe(1);
    expect(map.costOf({ col: 12, row: 9 })).toBeNull();
    expect(map.costOf({ col: -1, row: 0 })).toBeNull();
    expect(() => regionMap(data, 'atlantis')).toThrow('unknown region atlantis');
  });

  it('sees the hexes next to each visited one, within the map', () => {
    const seen = seenHexes(map, new Set(['0,0']));
    expect([...seen].sort()).toEqual(['0,0', '0,1', '1,0']);
  });

  it('routes the cheapest way through known hexes', () => {
    const all = new Set<string>();
    for (let col = 0; col < map.width; col++)
      for (let row = 0; row < map.height; row++) all.add(hexKey({ col, row }));
    const path = findPath(map, { col: 3, row: 8 }, { col: 20, row: 8 }, all);
    expect(path).toHaveLength(17);
    // Across the river only at a ford.
    const ford = findPath(map, { col: 11, row: 10 }, { col: 13, row: 10 }, all);
    expect(ford?.some((h) => h.col === 12 && h.row !== 8 && h.row !== 14)).toBe(false);
    expect(findPath(map, { col: 3, row: 8 }, { col: 12, row: 9 }, all)).toBeNull();
    expect(findPath(map, { col: 3, row: 8 }, { col: 20, row: 8 }, new Set(['3,8']))).toBeNull();
    expect(
      findPath(map, { col: 3, row: 8 }, { col: 5, row: 8 }, new Set(['3,8', '5,8'])),
    ).toBeNull();
    expect(findPath(map, { col: 3, row: 8 }, { col: 3, row: 8 }, all)).toBeNull();
  });
});

describe('party members', () => {
  it('logs with the day and quarter', () => {
    const w = world();
    note(w, 'Hello.');
    expect(w.log.at(-1)).toBe('Day 1, morning: Hello.');
  });

  it('rates and rolls checks, Broken at a disadvantage', () => {
    const w = world([6, 6, 1, 1, 1]);
    const snag = member(w, 'Snag');
    // Untrained (-1) with Str +0.
    expect(checkBonus(data, snag, 'juggle', ['str'])).toBe(-1);
    expect(bestAt(data, w.members, 'notice', ['wis'])?.character.name).toBe('Snag');
    expect(bestAt(data, [], 'notice', ['wis'])).toBeUndefined();
    expect(memberCheck(w, data, snag, 'notice', ['wis'], 8).success).toBe(true);
    snag.character = { ...snag.character, strain: { value: 0, broken: true } };
    expect(memberCheck(w, data, snag, 'notice', ['wis'], 8).dice).toHaveLength(3);
  });

  it('adds strain to Broken and beyond, and dies at double the maximum', () => {
    const w = world();
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, strain: { value: 10, broken: false } };
    addMemberStrain(w, data, snag, 1, 'condition');
    expect(snag.character.strain).toEqual({ value: 11, broken: true });
    expect(w.log.at(-1)).toContain('Snag is Broken.');
    addMemberStrain(w, data, snag, 1, 'condition');
    expect(snag.character.strain.value).toBe(12);
    addMemberStrain(w, data, snag, 10, 'condition');
    expect(snag.dead).toBe(true);
    expect(w.log.at(-1)).toContain('Snag dies of exhaustion and privation.');
  });

  it('rests, hurts, heals, and fully recovers', () => {
    const w = world();
    const grukk = member(w, 'Grukk');
    grukk.character = { ...grukk.character, strain: { value: 2, broken: false } };
    restQuarter(grukk);
    expect(grukk.character.strain.value).toBe(1);
    grukk.hungry = true;
    restQuarter(grukk);
    expect(grukk.character.strain.value).toBe(1);
    hurt(w, grukk, 99);
    expect(grukk.character.hp.current).toBe(1);
    healNight(data, grukk);
    expect(grukk.character.hp.current).toBe(2);
    grukk.frail = true;
    healNight(data, grukk);
    expect(grukk.character.hp.current).toBe(2);
    grukk.frail = false;
    for (let i = 0; i < 10; i++) healNight(data, grukk);
    expect(grukk.character.hp.current).toBe(grukk.character.hp.max);
  });
});
