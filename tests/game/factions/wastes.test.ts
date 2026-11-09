import { describe, expect, it } from 'vitest';
import { capture, reclaim, retaken } from '../../../src/game/factions/capture.ts';
import { pickGoal, weakestBase } from '../../../src/game/factions/goals.ts';
import { beginSiege, settle } from '../../../src/game/factions/siege.ts';
import { locationOf, startFactions } from '../../../src/game/factions/state.ts';
import { factionTurn } from '../../../src/game/factions/turn.ts';
import { breakFaction, warlordFalls } from '../../../src/game/factions/warlord-fall.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { hasFactions } from '../../../src/game/world/region.ts';
import {
  allyOf,
  allyTowns,
  heldShut,
  holderOf,
  isAlly,
  partySide,
  servedHere,
  shutTo,
} from '../../../src/game/world/siege-state.ts';
import { allyHosts } from '../../../src/game/world/siege-wait.ts';
import type { World } from '../../../src/game/world/types.ts';
import { siege } from '../world/helpers.ts';
import { data, faction } from './helpers.ts';
import { world } from '../world/helpers.ts';

/** A party in the Wastes, at its start, with the realm's factions at theirs. */
function wastes(): World {
  const w = world();
  w.realm = 'wastes';
  w.region = 'wastes-fringe';
  w.position = { col: 0, row: 0 };
  w.factions = {};
  startFactions(w, data);
  return w;
}

/** Cistern Rest stripped of the Well-Keepers' base, and taken by the Scrap King's Riders. */
function takenCisternRest(): World {
  const w = wastes();
  const keepers = faction(w, 'well-keepers');
  keepers.bases = keepers.bases.filter((b) => b.at !== 'cistern-rest');
  expect(capture(w, data, 'scrap-riders', 'cistern-rest')).toBe(true);
  return w;
}

const SCRAP_KING_HOARD = 'scrap-kings-pumpworks/scrap-kings-pumpworks-2/6,0';

describe('the Wastes’ factions (Sam’s calls)', () => {
  it('start only the realm’s own factions, and run a faction turn', () => {
    const w = wastes();
    expect(Object.keys(w.factions)).toHaveLength(6);
    expect(hasFactions(w, data)).toBe(true);
    factionTurn(w, data);
    expect(w.factions.warhost).toBeUndefined();
    expect(faction(w, 'scrap-riders').goal?.kind).toBe('root-out');
  });

  it('make the Well-Keepers the villages’ ally, beside the campaign’s', () => {
    expect(allyOf(data, 'dustwell')).toBe('well-keepers');
    expect(allyOf(data, 'final-well')).toBe('well-keepers');
    expect(allyOf(data, 'cinderhold')).toBe('settlements');
    expect(allyOf(data, 'scrap-kings-pumpworks')).toBeNull();
    expect(isAlly(data, 'well-keepers')).toBe(true);
    expect(isAlly(data, 'scrap-riders')).toBe(false);
    expect(allyTowns(data)).toEqual(expect.arrayContaining(['cinderhold', 'dustwell']));
    const s = siege({ town: 'cistern-rest', attacker: 'scrap-riders', defender: 'well-keepers' });
    expect(partySide(data, s)).toBe('defender');
  });

  it('send each warlord after villages on their own map only', () => {
    const w = wastes();
    // The Fringe's 2-HP villages are the weakest anywhere; the Salt Baron still keeps to his.
    expect(weakestBase(w, data, 'salt-packs')?.at).toBe('saltcross');
    expect(weakestBase(w, data, 'scrap-riders')?.at).toBe('cistern-rest');
    for (const id of ['scrap-riders', 'salt-packs', 'dune-horde', 'the-count', 'sun-host']) {
      pickGoal(w, data, id, 0);
      const goal = faction(w, id).goal;
      const hq = data.content.factions.factions.find((f) => f.id === id)?.hq as string;
      expect(locationOf(data, goal?.target?.at as string).region).toBe(locationOf(data, hq).region);
    }
    // With no village left on its map, a warlord has no one to root out.
    const keepers = faction(w, 'well-keepers');
    keepers.bases = keepers.bases.filter((b) => locationOf(data, b.at).region !== 'wastes-glass');
    expect(weakestBase(w, data, 'salt-packs')).toBeNull();
  });

  it('besiege only their own map’s villages over two years of turns', () => {
    const w = wastes();
    const warlords = data.content.factions.factions.filter((f) => f.reach === 'home');
    for (let month = 0; month < 24; month++) {
      factionTurn(w, data);
      for (const s of w.sieges) {
        const f = warlords.find((x) => x.id === s.attacker);
        if (f) expect(locationOf(data, s.town).region).toBe(locationOf(data, f.hq).region);
      }
    }
  });

  it('shut a held village to the party: no services, meals, or shelter', () => {
    const w = takenCisternRest();
    expect(holderOf(w, data, 'cistern-rest')).toBe('scrap-riders');
    expect(heldShut(w, data)).toBe(true);
    expect(shutTo(w, data, 'cistern-rest')).toBe(true);
    expect(shutTo(w, data, 'dustwell')).toBe(false);
    w.position = { col: 16, row: 11 };
    expect(servedHere(w, data)).toBe(false);
    expect(allyHosts(w, data)).toBe(false);
    w.position = { col: 4, row: 6 };
    expect(servedHere(w, data)).toBe(true);
    expect(allyHosts(w, data)).toBe(true);
    w.position = { col: 0, row: 0 };
    expect(servedHere(w, data)).toBe(false);
  });

  it('leave the campaign’s held towns open for their shop and inn', () => {
    const w = world();
    expect(heldShut(w, data)).toBe(false);
    const free = faction(w, 'settlements');
    free.bases = free.bases.filter((b) => b.at !== 'lanternfall');
    capture(w, data, 'warhost', 'lanternfall');
    expect(shutTo(w, data, 'lanternfall')).toBe(false);
  });

  it('free every village a warlord held when they fall, and end their sieges', () => {
    const w = takenCisternRest();
    const keepers = faction(w, 'well-keepers');
    beginSiege(w, data, 'scrap-riders', 'tinkers-oasis', 'well-keepers');
    beginSiege(w, data, 'well-keepers', 'cistern-rest', 'scrap-riders');
    expect(w.sieges).toHaveLength(2);
    expect(warlordFalls(w, data, SCRAP_KING_HOARD)).toBe(true);
    expect(w.sieges).toEqual([]);
    const riders = faction(w, 'scrap-riders');
    expect([riders.hp, riders.assets, riders.bases]).toEqual([0, [], []]);
    expect(holderOf(w, data, 'cistern-rest')).toBeNull();
    expect(keepers.bases.some((b) => b.at === 'cistern-rest')).toBe(true);
    expect(w.log.join('\n')).toContain("The Scrap King's Riders breaks apart.");
    // Only once, and only for a warlord's hoard.
    expect(warlordFalls(w, data, SCRAP_KING_HOARD)).toBe(false);
    expect(warlordFalls(w, data, 'buried-waterworks/buried-waterworks-1/0,0')).toBe(false);
  });

  it('break the warlord’s faction through the bus when the hoard is won', () => {
    const w = takenCisternRest();
    emit(w, data, { kind: 'fight-won', quest: null, garrison: SCRAP_KING_HOARD });
    expect(faction(w, 'scrap-riders').hp).toBe(0);
    expect(w.warlords).toContain('scrap-king');
    expect(holderOf(w, data, 'cistern-rest')).toBeNull();
  });

  it('leave a broken faction alone', () => {
    const w = wastes();
    breakFaction(w, data, 'sun-host');
    const before = w.log.length;
    breakFaction(w, data, 'sun-host');
    expect(w.log).toHaveLength(before);
  });

  it('pay Renown for the Wastes’ own projects (Sam’s call): a village retaken, a siege lifted', () => {
    const w = takenCisternRest();
    retaken(w, data, 'cistern-rest');
    expect(w.renown).toBe(2);
    const s = beginSiege(w, data, 'scrap-riders', 'tinkers-oasis', 'well-keepers');
    s.joined = true;
    faction(w, 'scrap-riders').assets = [];
    expect(settle(w, data, s)).toBe('lifted');
    expect(w.renown).toBe(4);
  });

  it('give a village back to the Well-Keepers, never to the campaign’s ally', () => {
    const w = takenCisternRest();
    faction(w, 'scrap-riders').bases = [];
    expect(reclaim(w, data, 'cistern-rest')).toBe(true);
    expect(w.log.at(-1)).toContain('Cistern Rest is free again: The Well-Keepers return.');
    expect(reclaim(w, data, 'cinderhold')).toBe(false);
  });
});
