import { describe, expect, it } from 'vitest';
import type { EconomySim } from '../../src/data/schemas/index.ts';
import { economyReport, passes } from '../../src/game/economy/report.ts';
import { runEconomy } from '../../src/game/economy/run.ts';
import { createRng } from '../../src/rules/rng.ts';
import { data } from './world/helpers.ts';

const base: EconomySim = {
  party: { maxHp: [8, 7], hpPerLevel: 4, purse: 85 },
  delve: { table: 'barrow', level: 1, fights: 4, days: 2 },
  fight: { hpLost: 0.15, deathChance: 0, deathFalloff: 0.5, xp: 0.5 },
  hirelings: [],
  ruin: { id: 'old-mine', every: 1000 },
  raiseQuest: { days: 10 },
  travelDays: 3,
  policies: [{ id: 'home', towns: ['westhold'] }],
  seeds: 3,
  delves: 3,
  lockouts: { worthlessDays: 1, stuckDelves: 1, belowLevel: 5 },
};
const sim = (change: Partial<EconomySim>): EconomySim => ({ ...base, ...change });
const run = (s: EconomySim, towns = ['westhold'], seed = 'x') =>
  runEconomy(createRng(seed), data, s, towns);
/** Every monster carries a lot of loot, so a village's threshold is soon passed. */
const rich = {
  ...data,
  content: {
    ...data.content,
    monsterCombat: data.content.monsterCombat.map((m) => ({
      ...m,
      loot: { count: 20, sides: 6 },
    })),
  },
};

describe('the economy validator (docs/rules-adaptation.md, Economy validator in Phase 9)', () => {
  it('delves, heals, and levels a party that never dies, with no lock-outs', () => {
    const r = run(sim({ lockouts: { ...base.lockouts, stuckDelves: 5 } }));
    expect(r.locks).toEqual({});
    expect(r.levels).toEqual([3, 3]);
    expect(r.innNights + r.campNights).toBeGreaterThan(0);
    expect(r.day).toBeGreaterThanOrEqual(6);
  });

  it('heals in camp once the inn is out of reach', () => {
    const r = run(
      sim({ party: { ...base.party, purse: 0 }, fight: { ...base.fight, hpLost: 0.5 } }),
    );
    expect(r.campNights).toBeGreaterThan(0);
  });

  it('replaces the dead it can’t raise with recruits at the lowest XP in the world', () => {
    const r = run(
      sim({ party: { ...base.party, purse: 0 }, fight: { ...base.fight, deathChance: 1 } }),
    );
    expect(r.locks).toEqual({ 'no-progress': 2 });
    expect(r.levels).toEqual([1, 1]);
    // One raising quest in the month, and no crowns for the rest.
    expect(r.raised).toEqual({ quest: 1, paid: 0, recruited: 5 });
  });

  it('takes a raising quest at most once a month', () => {
    const r = run(
      sim({
        delves: 12,
        party: { ...base.party, purse: 0 },
        fight: { ...base.fight, deathChance: 1 },
      }),
    );
    expect(r.raised.quest).toBeGreaterThan(1);
    expect(r.raised.quest).toBeLessThanOrEqual(Math.ceil(r.day / 30));
  });

  it('dies less as the party outlevels the dungeon', () => {
    const r = run(
      sim({
        delves: 12,
        fight: { ...base.fight, deathChance: 0.2, deathFalloff: 0, xp: 2 },
        lockouts: { ...base.lockouts, stuckDelves: 20 },
      }),
    );
    expect(Math.max(...r.levels)).toBeGreaterThan(1);
  });

  it('raises the dead when the purse allows', () => {
    const r = runEconomy(
      createRng('raise'),
      data,
      sim({ party: { ...base.party, purse: 10000 }, fight: { ...base.fight, deathChance: 0.5 } }),
      ['westhold'],
    );
    expect(r.levels.every((l) => l >= 1)).toBe(true);
    expect(r.raised.paid).toBeGreaterThan(0);
    expect(r.raised.recruited).toBe(0);
  });

  it('finds loot that pays nothing for too long, and a party that stops levelling', () => {
    const r = runEconomy(
      createRng('rich'),
      rich,
      sim({ delves: 6, fight: { ...base.fight, xp: 0 } }),
      ['highcairn'],
    );
    expect(r.locks['loot-worthless']).toBeDefined();
    expect(r.locks['no-progress']).toBe(2);
    const patient = sim({ delves: 6, lockouts: { ...base.lockouts, worthlessDays: 1000 } });
    expect(
      runEconomy(createRng('rich'), rich, patient, ['highcairn']).locks['loot-worthless'],
    ).toBe(undefined);
  });

  it('stops counting a stalled party once someone reaches the level that matters', () => {
    const r = run(
      sim({ delves: 4, lockouts: { ...base.lockouts, belowLevel: 2, stuckDelves: 1 } }),
    );
    expect(r.locks['no-progress']).toBeUndefined();
  });

  it('travels between towns, meeting each climate on the way', () => {
    const r = run(sim({ delves: 3 }), ['westhold', 'eastmarch', 'highcairn']);
    expect(r.day).toBeGreaterThanOrEqual(3 * 2 + 3 * 3);
  });

  it('needs a real table and real towns', () => {
    expect(() => run(sim({ delve: { ...base.delve, table: 'crypt' } }))).toThrow(
      'unknown encounter table crypt',
    );
    expect(() => run(base, ['atlantis'])).toThrow('unknown town atlantis');
  });

  it('reports each policy over its seeds, and passes only with no lock-outs', () => {
    const clean = economyReport(data, sim({ lockouts: { ...base.lockouts, stuckDelves: 5 } }));
    expect(clean).toHaveLength(1);
    expect(clean[0]?.locks['loot-worthless']).toEqual({ seeds: 0, firstDelve: null });
    expect(clean[0]?.raised).toEqual({ quest: 0, paid: 0, recruited: 0 });
    expect(passes(clean)).toBe(true);
    const grim = economyReport(data, sim({ seeds: 2, fight: { ...base.fight, xp: 0 } }));
    expect(grim[0]?.locks['no-progress']).toEqual({ seeds: 2, firstDelve: 2 });
    expect(passes(grim)).toBe(false);
  });

  it('takes on a ruin every few delves: its levels, caches, and vault (Phase 12f)', () => {
    const plain = run(sim({ delves: 1 }));
    const ruin = run(sim({ delves: 1, ruin: { id: 'old-mine', every: 1 } }));
    expect(ruin.purse).toBeGreaterThan(plain.purse);
    const city = { id: 'duskmere', every: 1 };
    expect(run(sim({ delves: 1, ruin: city })).purse).toBeGreaterThan(0);
    expect(run(sim({ delves: 1, ruin: { id: 'old-westgate', every: 1 } })).purse).toBeGreaterThan(
      0,
    );
    expect(() => run(sim({ ruin: { id: 'atlantis', every: 1 } }))).toThrow('unknown ruin atlantis');
  });

  it('signs on hirelings at home, pays their shares, and replaces one who leaves unpaid', () => {
    const r = run(sim({ hirelings: ['guard'], delves: 4 }));
    expect(r.hirelingsLeft).toBe(0);
    const broke = run(
      sim({
        hirelings: ['guard', 'mundane-physician'],
        party: { ...base.party, purse: 0 },
        delves: 10,
      }),
    );
    expect(broke.hirelingsLeft).toBeGreaterThan(0);
    expect(() => run(sim({ hirelings: ['jester'] }))).toThrow('unknown hireling jester');
    const report = economyReport(data, sim({ hirelings: ['guard'] }));
    expect(report[0]?.hirelingsLeft).toBeGreaterThanOrEqual(0);
  });
});
