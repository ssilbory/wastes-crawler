import { describe, expect, it } from 'vitest';
import { emit } from '../../../src/game/world/bus.ts';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { isRaided, raidedCost } from '../../../src/game/world/raids.ts';
import { stayAtInn } from '../../../src/game/world/services.ts';
import { enterTown, priceHere } from '../../../src/game/world/town.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { below } from '../dungeon/helpers.ts';
import { data, world } from './helpers.ts';

const CINDERHOLD = { col: 6, row: 12 };

/** The party in the Dark Lands, a raid on Cinderhold coming on day 10. */
function threatened(): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 7, row: 12 });
  w.raid = { town: 'cinderhold', day: 10, fighting: false };
  w.day = 5;
  return w;
}

describe('raids (docs/rules-adaptation.md, Raids)', () => {
  it('warn of a raid on a Dark Lands settlement as each month begins', () => {
    const w = world();
    w.day = 28;
    emit(w, data, { kind: 'day-passed' });
    expect(w.raid).toBeNull();
    w.day = 29;
    w.rng = scriptedRng([1]);
    emit(w, data, { kind: 'day-passed' });
    expect(w.raid).toEqual({ town: 'gutterwick', day: 37, fighting: false });
    expect(w.log.at(-1)).toContain('human raiders will strike Gutterwick within 7 days');
    // One raid at a time.
    w.raid = { town: 'gutterwick', day: 100, fighting: false };
    w.day = 59;
    w.rng = createRng('later');
    emit(w, data, { kind: 'day-passed' });
    expect(w.raid?.day).toBe(100);
  });

  it('sack an undefended settlement, raising its prices for a month', () => {
    const w = threatened();
    w.day = 8;
    emit(w, data, { kind: 'day-passed' });
    expect(w.raid).not.toBeNull();
    w.day = 9;
    emit(w, data, { kind: 'day-passed' });
    expect(w.raid).toBeNull();
    expect(w.raided).toEqual({ cinderhold: 40 });
    expect(w.log.at(-1)).toContain('Raiders sack Cinderhold. Prices there are up for a month.');
    expect(isRaided(w, 'cinderhold')).toBe(true);
    expect(isRaided(w, 'gutterwick')).toBe(false);
    expect(raidedCost(w, data, 'cinderhold', 10)).toBe(15);
    expect(raidedCost(w, data, 'gutterwick', 10)).toBe(10);
    enterRegion(w, 'dark-lands', CINDERHOLD);
    expect(priceHere(w, data, 10)).toBe(15);
    w.day = 40;
    expect(isRaided(w, 'cinderhold')).toBe(false);
    expect(priceHere(w, data, 10)).toBe(10);
  });

  it('meet a party arriving before the raid at the gates, once', () => {
    const w = threatened();
    enterRegion(w, 'dark-lands', CINDERHOLD);
    enterTown(w, data, 'cinderhold');
    expect(w.raid?.fighting).toBe(true);
    expect(w.encounter).toMatchObject({
      enemies: [['human-raider', 'human-raider', 'human-raider'], ['alliance-ranger']],
      hostile: true,
      spotted: false,
    });
    expect(w.encounter?.text).toContain('Raiders fall on Cinderhold!');
    w.encounter = null;
    enterTown(w, data, 'cinderhold');
    expect(w.encounter).toBeNull();
  });

  it('pay defenders who win, and nothing for other fights', () => {
    const w = threatened();
    w.purse = 0;
    w.raid = { town: 'cinderhold', day: 10, fighting: true };
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.purse).toBe(0);
    enterRegion(w, 'dark-lands', CINDERHOLD);
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.purse).toBe(60);
    expect(w.raid).toBeNull();
    expect(w.log.at(-1)).toContain('Cinderhold is saved. The settlement pays the defenders 60');
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.purse).toBe(60);
  });

  it('come while a party stays the night in the settlement, but not to the wrong town', () => {
    const w = threatened();
    w.purse = 100;
    enterRegion(w, 'dark-lands', CINDERHOLD);
    stayAtInn(w, data);
    expect(w.raid?.fighting).toBe(true);
    expect(w.encounter?.text).toContain('Raiders fall on Cinderhold!');
    const v = threatened();
    v.purse = 100;
    enterRegion(v, 'dark-lands', { col: 16, row: 15 });
    stayAtInn(v, data);
    expect(v.encounter).toBeNull();
    // Another region's town at the same spot isn't the raided one.
    const b = threatened();
    enterRegion(b, 'borderlands', CINDERHOLD);
    emit(b, data, { kind: 'town-entered', town: 'cinderhold' });
    expect(b.encounter).toBeNull();
  });

  it('never reach a party underground', () => {
    const w = below();
    w.raid = { town: 'cinderhold', day: 10, fighting: false };
    enterRegion(w, 'dark-lands', CINDERHOLD);
    emit(w, data, { kind: 'town-entered', town: 'cinderhold' });
    expect(w.encounter).toBeNull();
  });
});
