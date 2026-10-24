import { describe, expect, it } from 'vitest';
import { emit } from '../../../src/game/world/bus.ts';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { isRaided, raidedCost } from '../../../src/game/world/raids.ts';
import { stayAtInn } from '../../../src/game/world/services.ts';
import { enterTown, priceHere } from '../../../src/game/world/town.ts';
import type { World } from '../../../src/game/world/types.ts';
import type { FactionState } from '../../../src/data/schemas/index.ts';
import { pickGoal } from '../../../src/game/factions/goals.ts';
import { raidParty, resolveRaid, routRaid, warnRaid } from '../../../src/game/factions/raid.ts';
import type { HeldAsset } from '../../../src/game/factions/state.ts';
import { takeAction } from '../../../src/game/factions/turn.ts';
import type { Rng } from '../../../src/rules/rng.ts';
import { below } from '../dungeon/helpers.ts';
import { data, world } from './helpers.ts';

const CINDERHOLD = { col: 6, row: 12 };

/** The party in the Dark Lands, a raid on Cinderhold coming on day 10. */
function threatened(): World {
  const w = world();
  enterRegion(w, 'dark-lands', { col: 7, row: 12 });
  w.raid = { town: 'cinderhold', day: 10, fighting: false, asset: 'a1' };
  w.day = 5;
  return w;
}

/** Every die rolls its highest face, so checks go to the higher rating. */
const highRolls: Rng = { int: (_min, max) => max, next: () => 0.99, state: () => [0, 0, 0, 0] };

const bastion = (w: World) => w.factions.bastion as FactionState;
const company = (w: World) => bastion(w).assets.find((a) => a.uid === 'a1') as HeldAsset;

describe('raids (docs/rules-adaptation.md, Raids)', () => {
  it("come when the Bastion attacks a settlement, with a week's warning, one at a time", () => {
    const w = world();
    w.rng = highRolls;
    pickGoal(w, data, 'bastion', 0);
    company(w).at = 'lanternfall';
    expect(takeAction(w, data, 'bastion', () => undefined)).toBe(true);
    expect(w.raid).toEqual({ town: 'lanternfall', day: 8, fighting: false, asset: 'a1' });
    expect(w.log.at(-1)).toContain(
      'Word comes that The Dawnwall Bastion will strike Lanternfall within 7 days.',
    );
    // The raiders hold back until the day.
    expect(w.factions.settlements?.bases.some((b) => b.at === 'lanternfall')).toBe(true);
    // With a raid already coming, another attack falls at once.
    const struck: string[] = [];
    takeAction(w, data, 'bastion', (v, at) => struck.push(`${v}@${at}`));
    expect(struck).toEqual(['settlements@lanternfall']);
    expect(warnRaid(w, data, 'warhost')).toBeNull();
    // Fighting outside the raided settlements is no raid.
    w.raid = null;
    company(w).at = 'grisks-hold';
    expect(warnRaid(w, data, 'bastion')).toBeNull();
  });

  it('sack a settlement the raiders hit on the day, raising its prices for a month', () => {
    const w = threatened();
    w.rng = highRolls;
    pickGoal(w, data, 'bastion', 1);
    company(w).at = 'cinderhold';
    const settlements = w.factions.settlements as FactionState;
    settlements.assets = settlements.assets.filter((a) => a.at !== 'cinderhold');
    w.day = 8;
    emit(w, data, { kind: 'day-passed' });
    expect(w.raid).not.toBeNull();
    w.day = 9;
    emit(w, data, { kind: 'day-passed' });
    expect(w.raid).toBeNull();
    expect(w.raided).toEqual({ cinderhold: 40 });
    expect(w.log.at(-1)).toContain('Cinderhold is sacked. Prices there are up for a month.');
    expect(bastion(w).goal?.progress).toBe(8);
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

  it('are held off when the raiders miss, never came, or the Bastion is gone', () => {
    const w = threatened();
    w.rng = highRolls;
    pickGoal(w, data, 'bastion', 1);
    company(w).at = 'cinderhold';
    // The settlements' Force 4 rolls as high as the Bastion's 5 only with help: make it 5.
    (w.factions.settlements as FactionState).force = 5;
    expect(resolveRaid(w, data, 'cinderhold')).toBe(false);
    const v = threatened();
    v.day = 9;
    emit(v, data, { kind: 'day-passed' });
    expect(v.log.at(-1)).toContain('Cinderhold holds off the raiders.');
    bastion(v).hp = 0;
    expect(resolveRaid(v, data, 'cinderhold')).toBe(false);
    // A strike that razes everything leaves the next raider nothing to hit.
    const u = threatened();
    u.rng = highRolls;
    pickGoal(u, data, 'bastion', 1);
    const settlements = u.factions.settlements as FactionState;
    settlements.assets = [];
    settlements.bases = settlements.bases.filter((b) => b.at !== 'mirewatch');
    for (const a of bastion(u).assets) a.at = 'lanternfall';
    expect(resolveRaid(u, data, 'lanternfall')).toBe(true);
    expect(settlements.bases.some((b) => b.at === 'lanternfall')).toBe(false);
  });

  it('find no one to stand with the town while a fallen party has none', () => {
    const w = threatened();
    enterRegion(w, 'dark-lands', CINDERHOLD);
    w.members = [];
    enterTown(w, data, 'cinderhold');
    expect(w.encounter).toBeNull();
    expect(w.raid?.fighting).toBe(false);
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
    // Rangers leading the raid bring their own patrol; with no leader, the content's raiders.
    w.raid = { town: 'cinderhold', day: 10, fighting: false, asset: 'a2' };
    expect(raidParty(w, data)).toEqual([['alliance-ranger', 'alliance-ranger']]);
    w.raid.asset = 'a3';
    expect(raidParty(w, data)).toEqual(data.content.raidRules.raiders);
    w.raid.asset = 'gone';
    expect(raidParty(w, data)).toEqual(data.content.raidRules.raiders);
  });

  it('pay defenders who win, and nothing for other fights', () => {
    const w = threatened();
    w.purse = 0;
    w.raid = { town: 'cinderhold', day: 10, fighting: true, asset: 'a1' };
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.purse).toBe(0);
    enterRegion(w, 'dark-lands', CINDERHOLD);
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.purse).toBe(60);
    expect(w.raid).toBeNull();
    expect(w.log.join('\n')).toContain('Cinderhold is saved. The settlement pays the defenders 60');
    // The raiding company is destroyed.
    expect(bastion(w).assets.some((a) => a.uid === 'a1')).toBe(false);
    expect(w.log.join('\n')).toContain('the raiders were routed at Cinderhold');
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null });
    expect(w.purse).toBe(60);
    // A rout with no leader left changes nothing.
    w.raid = { town: 'cinderhold', day: 10, fighting: true, asset: 'a1' };
    const lines = w.log.length;
    routRaid(w, data);
    expect(w.log).toHaveLength(lines);
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
