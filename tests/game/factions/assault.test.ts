import { describe, expect, it } from 'vitest';
import {
  assault,
  defenders,
  groupOf,
  halveRows,
  mergeGroups,
  toRows,
  walled,
} from '../../../src/game/factions/assault.ts';
import { pickGoal } from '../../../src/game/factions/goals.ts';
import { addAsset } from '../../../src/game/factions/state.ts';
import { progressOf } from '../../../src/game/world/major-projects.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { siege } from '../world/helpers.ts';
import { data, faction, factionWorld, held } from './helpers.ts';

/** The warhost's fighters before a settlement, the party far off. */
function before(town: string): World {
  const w = factionWorld();
  w.position = { col: 2, row: 2 };
  for (const a of faction(w, 'warhost').assets) a.at = town;
  // A faction at war has always picked a goal by its first Attack.
  pickGoal(w, data, 'warhost', 0);
  return w;
}

const hp = (w: World, id: string, at: string) =>
  faction(w, id)
    .assets.filter((a) => a.at === at)
    .reduce((sum, a) => sum + a.hp, 0) + (faction(w, id).bases.find((b) => b.at === at)?.hp ?? 0);

const walls = (w: World) => {
  w.majorProjects['wall-lanternfall'] = { ...progressOf(w, 'wall-lanternfall'), done: 0 };
};

describe('a siege’s assault (docs/rules-adaptation.md, Sieges: The battle, Walls, Losses)', () => {
  it('lines fighters up in rows of eight, at most three', () => {
    const ids = (n: number) => Array.from({ length: n }, (_, i) => `m${i}`);
    expect(toRows(ids(20)).map((r) => r.length)).toEqual([8, 8, 4]);
    expect(toRows(ids(30)).map((r) => r.length)).toEqual([8, 8, 8]);
    expect(toRows([])).toEqual([]);
  });

  it('fights groups as one, row by row, in rows of eight, at most three (Phase 23g)', () => {
    const band = [['a', 'a', 'a'], ['p']];
    expect(mergeGroups([band])).toEqual(band);
    expect(mergeGroups([band, [['m', 'm']]])).toEqual([['a', 'a', 'a', 'm', 'm'], ['p']]);
    const eight = Array.from({ length: 8 }, () => 'x');
    expect(mergeGroups([[eight], [['y']]])).toEqual([eight, ['y']]);
    // Past three rows, they are lined up again in rows of eight.
    expect(mergeGroups([[['a'], ['b'], ['c'], ['d']]])).toEqual([['a', 'b', 'c', 'd']]);
    expect(mergeGroups([])).toEqual([]);
  });

  it('halves a group, rounding up, from the front rows', () => {
    expect(halveRows([['a', 'a', 'a'], ['b']])).toEqual([['a', 'a']]);
    expect(halveRows([['a'], ['b', 'b']])).toEqual([['a'], ['b']]);
    expect(
      halveRows([
        ['a', 'a', 'a'],
        ['b', 'b', 'b'],
      ]),
    ).toEqual([['a', 'a', 'a']]);
  });

  it('is slowed by walls, unless Siege Experts are among the besiegers', () => {
    const w = before('lanternfall');
    const s = siege({ town: 'lanternfall' });
    expect(walled(w, data, s)).toBe(false);
    walls(w);
    expect(walled(w, data, s)).toBe(true);
    addAsset(data, faction(w, 'warhost'), 'siege-experts', 'lanternfall');
    expect(walled(w, data, s)).toBe(false);
  });

  it('fields an asset as its patrol, or as militia for one that sends none', () => {
    const w = before('lanternfall');
    expect(groupOf(data, 'warhost', held(w, 'warhost', 'infantry'))).toEqual([
      ['beastman-trooper', 'beastman-trooper', 'beastman-trooper'],
      ['predator-beastman'],
    ]);
    expect(groupOf(data, 'warhost', held(w, 'warhost', 'armed-guards'))).toEqual([
      ['thug-or-militia', 'thug-or-militia', 'thug-or-militia'],
    ]);
  });

  it('raises the settlement’s militia and a fighter per hit point of the holder’s assets', () => {
    const w = before('lanternfall');
    // A village's 4, and the farmsteads' 4 as militia.
    expect(defenders(w, data, siege({ town: 'lanternfall' }))).toEqual(
      Array.from({ length: 8 }, () => 'thug-or-militia'),
    );
    // A town's 8, and the local guard's 4 as veterans.
    const town = defenders(w, data, siege({ town: 'cinderhold' }));
    expect(town.filter((m) => m === 'thug-or-militia')).toHaveLength(8);
    expect(town.filter((m) => m === 'veteran-soldier')).toHaveLength(4);
    // A place on no map raises a village's.
    expect(defenders(w, data, siege({ town: 'dawnwall', defender: 'nobody' }))).toHaveLength(4);
  });

  it('is turned back by the walls on their roll, before anyone fights', () => {
    const w = before('lanternfall');
    walls(w);
    w.rng = scriptedRng([50]);
    expect(assault(w, data, siege({ town: 'lanternfall' }), [])).toEqual({
      held: true,
      turned: true,
    });
    expect(w.log.at(-1)).toContain(
      "the walls of Lanternfall turned Grisk's Warhost's assault back",
    );
  });

  it('holds with no one left to assault, and falls with no one to defend', () => {
    const w = before('lanternfall');
    const s = siege({ town: 'lanternfall' });
    faction(w, 'warhost').assets = [];
    expect(assault(w, data, s, [])).toEqual({ held: true, turned: false });
    const empty = before('lanternfall');
    const none = { ...data.content.siegeRules, militia: { village: 0, town: 0, city: 0 } };
    const bare = { ...data, content: { ...data.content, siegeRules: none } };
    faction(empty, 'settlements').assets = [];
    expect(assault(empty, bare, s, [])).toEqual({ held: false, turned: false });
    // Each of the 14 attackers costs the undefended base a hit point: its 2 are gone.
    expect(faction(empty, 'settlements').bases.some((b) => b.at === 'lanternfall')).toBe(false);
    expect(empty.log.join('\n')).toContain(
      "Grisk's Warhost storms Lanternfall, and no one stands to defend it.",
    );
  });

  it('costs the holder nothing for its militia, and 2 more for an assault lost', () => {
    // Cinderhold's 8 militia, alone, against the armed guards: they hold, and the base is whole.
    const w = before('cinderhold');
    const free = faction(w, 'settlements');
    free.assets = free.assets.filter((a) => a.at !== 'cinderhold');
    const warhost = faction(w, 'warhost');
    warhost.assets = warhost.assets.filter((a) => a.asset === 'armed-guards');
    w.rng = createRng('militia');
    expect(assault(w, data, siege({ town: 'cinderhold' }), []).held).toBe(true);
    expect(free.bases.find((b) => b.at === 'cinderhold')?.hp).toBe(17);
    // Lanternfall's 4 militia, alone, against the whole warhost and more: overrun, the base pays 2.
    const v = before('lanternfall');
    const village = faction(v, 'settlements');
    village.assets = village.assets.filter((a) => a.at !== 'lanternfall');
    const base = village.bases.find((b) => b.at === 'lanternfall');
    if (base) base.hp = 10;
    for (const asset of ['infantry', 'infantry', 'scouts', 'scouts'])
      addAsset(data, faction(v, 'warhost'), asset, 'lanternfall');
    v.rng = createRng('overrun');
    expect(assault(v, data, siege({ town: 'lanternfall' }), []).held).toBe(false);
    expect(base?.hp).toBe(8);
  });

  it('fights the rest out and costs each side a hit point per fighter lost', () => {
    const w = before('cinderhold');
    w.rng = createRng('assault');
    const s = siege({ town: 'cinderhold' });
    const share = held(w, 'warhost', 'infantry');
    const attackers = hp(w, 'warhost', 'cinderhold');
    const holders = hp(w, 'settlements', 'cinderhold');
    const r = assault(w, data, s, [share]);
    expect(r.turned).toBe(false);
    // The party's share sat it out.
    expect(share.hp).toBe(6);
    expect(hp(w, 'warhost', 'cinderhold') + hp(w, 'settlements', 'cinderhold')).toBeLessThan(
      attackers + holders,
    );
    expect(w.log.join('\n')).toMatch(
      /Grisk's Warhost storms Cinderhold; the defenders (hold|are overrun)\./,
    );
  });

  it('holds when the defenders outnumber a thin line, halved behind walls', () => {
    const w = before('cinderhold');
    // Only the armed guards, 3 hit points of militia, come on.
    const warhost = faction(w, 'warhost');
    warhost.assets = warhost.assets.filter((a) => a.asset === 'armed-guards');
    w.rng = createRng('hold');
    expect(assault(w, data, siege({ town: 'cinderhold' }), [])).toEqual({
      held: true,
      turned: false,
    });
    expect(w.log.at(-1)).toContain("Grisk's Warhost storms Cinderhold; the defenders hold.");
  });

  it('sends only half of each group up the walls', () => {
    const w = before('lanternfall');
    walls(w);
    const warhost = faction(w, 'warhost');
    warhost.assets = warhost.assets.filter((a) => a.asset === 'infantry');
    // The walls don't turn it back; 3 of the warband's 6 come on.
    const rest = createRng('walls');
    let first = true;
    w.rng = {
      ...rest,
      int: (min: number, max: number) => {
        if (!first) return rest.int(min, max);
        first = false;
        return 99;
      },
    };
    const lines = w.log.length;
    assault(w, data, siege({ town: 'lanternfall' }), []);
    expect(w.log.length).toBeGreaterThan(lines);
    expect(held(w, 'warhost', 'infantry').hp).toBeGreaterThanOrEqual(3);
  });

  it('spills losses past the assets onto the base, razing it', () => {
    // The warhost at full strength against a village of 2-hp base and 4-hp farmsteads.
    const w = before('lanternfall');
    for (const asset of ['infantry', 'infantry', 'scouts', 'scouts'])
      addAsset(data, faction(w, 'warhost'), asset, 'lanternfall');
    w.rng = createRng('raze');
    const r = assault(w, data, siege({ town: 'lanternfall' }), []);
    expect(r).toEqual({ held: false, turned: false });
    expect(faction(w, 'settlements').bases.some((b) => b.at === 'lanternfall')).toBe(false);
    expect(w.raided.lanternfall).toBeGreaterThan(w.day);
  });

  it('spends a defender’s losses on its assets alone when it has no base there', () => {
    const w = before('lanternfall');
    for (const asset of ['infantry', 'infantry', 'scouts', 'scouts'])
      addAsset(data, faction(w, 'warhost'), asset, 'lanternfall');
    const free = faction(w, 'settlements');
    free.bases = free.bases.filter((b) => b.at !== 'lanternfall');
    const before_ = free.hp;
    w.rng = createRng('raze');
    assault(w, data, siege({ town: 'lanternfall' }), []);
    expect(free.hp).toBe(before_);
    expect(w.raided.lanternfall).toBeUndefined();
  });
});
