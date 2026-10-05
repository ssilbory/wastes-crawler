import { describe, expect, it } from 'vitest';
import { defenderAt, hurtAsset, hurtBase, strike } from '../../../src/game/factions/combat.ts';
import {
  addAsset,
  assetName,
  factionOf,
  hasDamage,
  heldOf,
  isActive,
  locationName,
  magicAllows,
  startFactions,
} from '../../../src/game/factions/state.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, faction, factionWorld, held } from './helpers.ts';

describe('faction state (6.7.0)', () => {
  it('starts each faction with an HQ base at its maximum hit points', () => {
    const w = factionWorld();
    const warhost = faction(w, 'warhost');
    expect(warhost).toMatchObject({ hp: 20, treasure: 4, xp: 0, goal: null, serial: 4 });
    expect(warhost.bases).toEqual([{ at: 'grisks-hold', hp: 20, max: 20 }]);
    expect(warhost.assets.map((a) => a.uid)).toEqual(['a1', 'a2', 'a3', 'a4']);
    expect(faction(w, 'settlements').bases.map((b) => [b.at, b.hp, b.max])).toEqual([
      ['cinderhold', 17, 17],
      ['gutterwick', 4, 4],
      ['lanternfall', 2, 2],
      ['mirewatch', 2, 2],
    ]);
    // Starting again leaves running factions alone.
    warhost.treasure = 99;
    startFactions(w, data);
    expect(faction(w, 'warhost').treasure).toBe(99);
  });

  it('looks up names, ratings, and what assets can do', () => {
    const w = factionWorld();
    expect(() => factionOf(data, 'nobody')).toThrow('unknown faction nobody');
    expect(assetName(data, 'warhost', 'infantry')).toBe('Beastman Warband');
    expect(assetName(data, 'warhost', 'witch-hunters')).toBe('Witch Hunters');
    expect(locationName(data, 'dawnwall')).toBe('Dawnwall');
    expect(locationName(data, 'nowhere')).toBe('nowhere');
    expect(isActive(undefined)).toBe(false);
    expect(heldOf(data, faction(w, 'warhost'), 'force')).toHaveLength(2);
    expect(magicAllows(data, 'settlements', 'enchanted-elites')).toBe(false);
    expect(magicAllows(data, 'bastion', 'enchanted-elites')).toBe(true);
    expect(hasDamage(data, 'infantry')).toBe(true);
    expect(hasDamage(data, 'farmers')).toBe(false);
    expect(hasDamage(data, 'informers')).toBe(false);
    expect(hasDamage(data, 'seditionists')).toBe(false);
  });
});

describe('faction damage (6.6.0, 6.1.0)', () => {
  it('destroys assets at zero and passes base damage to the faction without overflow', () => {
    const w = factionWorld();
    const guard = held(w, 'settlements', 'local-guard');
    expect(hurtAsset(w, data, 'settlements', guard, 3)).toBe(3);
    expect(hurtAsset(w, data, 'settlements', guard, 9)).toBe(1);
    expect(faction(w, 'settlements').assets).not.toContain(guard);
    expect(w.log.at(-1)).toContain('The Free Settlements loses its Town Watch at Cinderhold.');
    expect(hurtBase(w, data, 'settlements', 'lanternfall', 5)).toBe(2);
    expect(faction(w, 'settlements').hp).toBe(15);
    expect(w.log.at(-1)).toContain('driven out of Lanternfall');
    expect(hurtBase(w, data, 'settlements', 'lanternfall', 5)).toBe(0);
  });

  it('collapses a faction at zero hit points', () => {
    const w = factionWorld();
    const s = faction(w, 'loyalists');
    s.hp = 3;
    expect(hurtBase(w, data, 'loyalists', 'ember-shrine', 4)).toBe(4);
    expect(s).toMatchObject({ hp: 0, assets: [], bases: [] });
    expect(w.log.at(-1)).toContain('The Faithful has collapsed.');
  });

  it("defends with the sturdiest asset present, then the base, else can't", () => {
    const w = factionWorld();
    const s = faction(w, 'warhost');
    expect(defenderAt(s, 'grisks-hold')?.valueOf()).toBe(held(w, 'warhost', 'infantry'));
    s.assets.reverse();
    expect(defenderAt(s, 'grisks-hold')?.valueOf()).toBe(held(w, 'warhost', 'infantry'));
    s.assets = [];
    expect(defenderAt(s, 'grisks-hold')).toBe('base');
    expect(defenderAt(s, 'cinderhold')).toBeNull();
  });
});

describe('faction strikes (6.6.0 Attack)', () => {
  it('hits for the attack damage, or takes the counter on a miss; ties go to the defender', () => {
    const w = factionWorld();
    const band = held(w, 'warhost', 'infantry');
    band.at = 'cinderhold';
    const guard = held(w, 'settlements', 'local-guard');
    // Martial: the warhost keeps the better of 2 and 7 (13) against 9 + 4; the guard counters
    // 1d4+1 = 4.
    w.rng = scriptedRng([2, 7, 9, 3]);
    expect(strike(w, data, 'warhost', band, 'settlements', new Set())).toEqual({
      hit: false,
      dealt: 0,
      razed: false,
    });
    expect(band.hp).toBe(2);
    // 10 + 6 against 1 + 4; 1d8 = 2.
    w.rng = scriptedRng([10, 1, 1, 2]);
    expect(strike(w, data, 'warhost', band, 'settlements', new Set())).toEqual({
      hit: true,
      dealt: 2,
      razed: false,
    });
    expect(guard.hp).toBe(2);
  });

  it('razes a base left without defenders, or only damages it', () => {
    const w = factionWorld();
    const band = held(w, 'warhost', 'infantry');
    band.at = 'lanternfall';
    faction(w, 'settlements').assets = faction(w, 'settlements').assets.filter(
      (a) => a.at !== 'lanternfall',
    );
    w.rng = scriptedRng([10, 1, 1, 1]);
    expect(strike(w, data, 'warhost', band, 'settlements', new Set())).toMatchObject({
      hit: true,
      dealt: 1,
      razed: false,
    });
    w.rng = scriptedRng([10, 1, 1, 8]);
    expect(strike(w, data, 'warhost', band, 'settlements', new Set())).toMatchObject({
      dealt: 1,
      razed: true,
    });
    // A miss against a base costs nothing.
    band.at = 'gutterwick';
    faction(w, 'settlements').assets = [];
    w.rng = scriptedRng([1, 1, 10]);
    expect(strike(w, data, 'warhost', band, 'settlements', new Set()).hit).toBe(false);
    expect(band.hp).toBe(6);
  });

  it('takes no counter from an asset that has none, and fanatics pay for their zeal', () => {
    const w = factionWorld();
    const s = faction(w, 'bastion');
    const fanatics = addAsset(data, s, 'temple-fanatics', 'ember-shrine');
    const thugs = held(w, 'loyalists', 'thugs');
    faction(w, 'loyalists').assets = [thugs];
    // Fanatics F5 roll 1 against the Faithful's Force 1 rolling 10: a miss, and Cult Cells have
    // no counter.
    w.rng = scriptedRng([1, 10]);
    strike(w, data, 'bastion', fanatics, 'loyalists', new Set());
    expect(fanatics.hp).toBe(6);
    // A hit of 2d6 = 5 kills the cult cell; the fanatics take 1d4 = 3 for it.
    w.rng = scriptedRng([10, 1, 4, 1, 3]);
    strike(w, data, 'bastion', fanatics, 'loyalists', new Set());
    expect(fanatics.hp).toBe(3);
    // Fanatics defending against a miss take 1d4 too.
    const warband = held(w, 'warhost', 'infantry');
    warband.at = 'ember-shrine';
    faction(w, 'loyalists').assets = [];
    const defending = addAsset(data, s, 'temple-fanatics', 'cinderhold');
    warband.at = 'cinderhold';
    faction(w, 'settlements').assets = [];
    // A miss: the fanatics counter 2d6 = 4 and take 1d4 = 1.
    w.rng = scriptedRng([1, 1, 10, 2, 2, 1]);
    strike(w, data, 'warhost', warband, 'bastion', new Set());
    expect(defending.hp).toBe(5);
    expect(warband.hp).toBe(2);
  });

  it('steals Treasure on a hit: Front Merchant once a turn, Siege Experts each time', () => {
    const w = factionWorld();
    const merchant = held(w, 'loyalists', 'front-merchant');
    merchant.at = 'mirewatch';
    const farm = held(w, 'settlements', 'farmers');
    farm.hp = 40;
    const settlements = faction(w, 'settlements');
    settlements.treasure = 5;
    const stolen = new Set<string>();
    // W3 vs W5: 9 + 3 against 1 + 5; 1d4 = 1.
    for (let i = 0; i < 2; i++) {
      w.rng = scriptedRng([9, 1, 1]);
      strike(w, data, 'loyalists', merchant, 'settlements', stolen);
    }
    expect(settlements.treasure).toBe(4);
    expect(faction(w, 'loyalists').treasure).toBe(3);
    const engines = addAsset(data, faction(w, 'warhost'), 'siege-experts', 'mirewatch');
    // F6 vs W5: Martial rolls 10 and 1, against 1; 1d6 = 1; steals 1d4 = 4 of the 4 left.
    w.rng = scriptedRng([10, 1, 1, 1, 4]);
    strike(w, data, 'warhost', engines, 'settlements', stolen);
    expect(settlements.treasure).toBe(0);
    expect(faction(w, 'warhost').treasure).toBe(8);
  });
});
