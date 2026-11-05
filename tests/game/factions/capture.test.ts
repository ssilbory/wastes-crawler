import { describe, expect, it } from 'vitest';
import {
  baseSize,
  capture,
  growBases,
  loseBuilt,
  reclaim,
  reclaimAll,
  retakeGoal,
  retaken,
} from '../../../src/game/factions/capture.ts';
import { beginSiege, settle } from '../../../src/game/factions/siege.ts';
import { institutionId } from '../../../src/game/world/institution-projects.ts';
import { progressOf } from '../../../src/game/world/major-projects.ts';
import { holderOf } from '../../../src/game/world/siege-state.ts';
import type { World } from '../../../src/game/world/types.ts';
import { siege as siegeAt } from '../world/helpers.ts';
import { data, faction, factionWorld } from './helpers.ts';

/** Lanternfall stripped of the Free Settlements' base and farms, the party far off. */
function bare(): World {
  const w = factionWorld();
  w.position = { col: 2, row: 2 };
  const free = faction(w, 'settlements');
  free.assets = free.assets.filter((a) => a.at !== 'lanternfall');
  free.bases = free.bases.filter((b) => b.at !== 'lanternfall');
  return w;
}

const baseAt = (w: World, id: string, at: string) => faction(w, id).bases.find((b) => b.at === at);

describe('capture (docs/rules-adaptation.md, Sieges: Capture; Phase 23b)', () => {
  it('sizes a settlement’s base as the ally’s there', () => {
    expect(baseSize(data, 'cinderhold')).toBe(17);
    expect(baseSize(data, 'lanternfall')).toBe(2);
    expect(baseSize(data, 'atlantis')).toBe(1);
  });

  it('gives the attacker a 1-HP base in the ally’s settlement, to be bought up', () => {
    const w = bare();
    expect(capture(w, data, 'warhost', 'lanternfall')).toBe(true);
    expect(baseAt(w, 'warhost', 'lanternfall')).toEqual({
      at: 'lanternfall',
      hp: 1,
      max: 2,
      growing: true,
    });
    expect(holderOf(w, data, 'lanternfall')).toBe('warhost');
    expect(w.log.at(-1)).toContain("Grisk's Warhost now holds Lanternfall.");
    // Not twice, not for the ally, not elsewhere, and not for a faction that is gone.
    expect(capture(w, data, 'warhost', 'lanternfall')).toBe(false);
    expect(capture(w, data, 'settlements', 'lanternfall')).toBe(false);
    expect(capture(w, data, 'bastion', 'dawnwall')).toBe(false);
    faction(w, 'bastion').hp = 0;
    expect(capture(w, data, 'bastion', 'lanternfall')).toBe(false);
  });

  it('plants a whole base where the ally’s was a single hit point', () => {
    const w = bare();
    const small = {
      ...data,
      content: {
        ...data.content,
        factions: {
          ...data.content.factions,
          factions: data.content.factions.factions.map((f) =>
            f.id === 'settlements'
              ? { ...f, bases: f.bases.map((b) => (b.at === 'lanternfall' ? { ...b, hp: 1 } : b)) }
              : f,
          ),
        },
      },
    };
    capture(w, small, 'warhost', 'lanternfall');
    expect(baseAt(w, 'warhost', 'lanternfall')).toEqual({ at: 'lanternfall', hp: 1, max: 1 });
  });

  it('loses what the party built there: projects, institutions, and Workings', () => {
    const w = bare();
    const done = { ...progressOf(w, 'wall-lanternfall'), done: 0 };
    w.majorProjects['wall-lanternfall'] = done;
    w.majorProjects[institutionId('workshop', 'lanternfall')] = done;
    w.majorProjects['restore-scrapmarch-pumps'] = done;
    w.workings = [
      { working: 'watch-lamps', town: 'lanternfall', lead: 'x', daysLeft: 0, away: 0, done: 0 },
    ];
    loseBuilt(w, data, 'lanternfall');
    expect(Object.keys(w.majorProjects)).toEqual(['restore-scrapmarch-pumps']);
    expect(w.workings).toEqual([]);
    expect(w.log.join('\n')).toContain('Lost with Lanternfall: Wall Lanternfall');
    const lines = w.log.length;
    loseBuilt(w, data, 'mirewatch');
    expect(w.log.length).toBe(lines);
  });

  it('gives the ally back a settlement of its own that no one holds', () => {
    const w = bare();
    capture(w, data, 'warhost', 'lanternfall');
    // Held, or the ally's already, or not the ally's at all: nothing to take back.
    expect(reclaim(w, data, 'lanternfall')).toBe(false);
    expect(reclaim(w, data, 'cinderhold')).toBe(false);
    expect(reclaim(w, data, 'dawnwall')).toBe(false);
    faction(w, 'warhost').bases = faction(w, 'warhost').bases.filter((b) => b.at !== 'lanternfall');
    expect(reclaim(w, data, 'lanternfall')).toBe(true);
    expect(baseAt(w, 'settlements', 'lanternfall')).toMatchObject({ hp: 1, max: 2 });
    expect(w.log.at(-1)).toContain('Lanternfall is free again: The Free Settlements return.');
    // A collapsed ally takes nothing back.
    const gone = bare();
    faction(gone, 'settlements').hp = 0;
    expect(reclaim(gone, data, 'lanternfall')).toBe(false);
  });

  it('takes back every settlement whose holder has collapsed', () => {
    const w = bare();
    capture(w, data, 'warhost', 'lanternfall');
    faction(w, 'warhost').hp = 0;
    // Not while a siege is at its walls: it falls to the besieger instead.
    w.sieges = [{ ...siegeAt(), town: 'lanternfall' }];
    reclaimAll(w, data);
    expect(baseAt(w, 'settlements', 'lanternfall')).toBeUndefined();
    w.sieges = [];
    reclaimAll(w, data);
    expect(baseAt(w, 'settlements', 'lanternfall')).toBeDefined();
  });

  it('pays Renown for a settlement taken back', () => {
    const w = bare();
    retaken(w, data, 'lanternfall');
    expect(w.renown).toBe(2);
    expect(w.log.at(-1)).toContain('Lanternfall thanks the party for its freedom: 2 Renown.');
  });

  it('buys a taken base up a Treasure a hit point, until it is whole', () => {
    const s = { ...faction(factionWorld(), 'warhost'), treasure: 2 };
    s.bases = [{ at: 'lanternfall', hp: 1, max: 4, growing: true }, ...s.bases];
    growBases(s);
    expect([s.bases[0], s.treasure]).toEqual([
      { at: 'lanternfall', hp: 3, max: 4, growing: true },
      0,
    ]);
    s.treasure = 5;
    growBases(s);
    expect([s.bases[0], s.treasure]).toEqual([{ at: 'lanternfall', hp: 4, max: 4 }, 4]);
  });

  it('sets the ally on retaking a held settlement before anything else', () => {
    const w = bare();
    const free = faction(w, 'settlements');
    free.goal = { kind: 'peaceable-kingdom', target: null, progress: 2 };
    retakeGoal(w, data);
    expect(free.goal.kind).toBe('peaceable-kingdom');
    capture(w, data, 'warhost', 'lanternfall');
    retakeGoal(w, data);
    expect(free.goal).toEqual({
      kind: 'root-out',
      target: { faction: 'warhost', at: 'lanternfall' },
      progress: 0,
    });
    free.goal.progress = 1;
    retakeGoal(w, data);
    expect(free.goal.progress).toBe(1);
    free.hp = 0;
    free.goal = null;
    retakeGoal(w, data);
    expect(free.goal).toBeNull();
  });

  it('ends the ally’s own siege of a held settlement by taking it back', () => {
    const w = bare();
    capture(w, data, 'warhost', 'lanternfall');
    for (const a of free(w).assets) a.at = 'lanternfall';
    const s = beginSiege(w, data, 'settlements', 'lanternfall', 'warhost');
    s.joined = true;
    faction(w, 'warhost').bases = faction(w, 'warhost').bases.filter((b) => b.at !== 'lanternfall');
    expect(settle(w, data, s)).toBe('fallen');
    expect(holderOf(w, data, 'lanternfall')).toBeNull();
    expect(baseAt(w, 'settlements', 'lanternfall')).toBeDefined();
    expect(w.renown).toBe(2);
    // Without the party in it, the town comes back but pays nothing.
    const quiet = bare();
    capture(quiet, data, 'warhost', 'lanternfall');
    for (const a of free(quiet).assets) a.at = 'lanternfall';
    const q = beginSiege(quiet, data, 'settlements', 'lanternfall', 'warhost');
    faction(quiet, 'warhost').bases = [];
    settle(quiet, data, q);
    expect(quiet.renown).toBe(0);
  });

  it('lets a rival take a held settlement from its holder', () => {
    const w = bare();
    capture(w, data, 'warhost', 'lanternfall');
    for (const a of faction(w, 'bastion').assets) a.at = 'lanternfall';
    const s = beginSiege(w, data, 'bastion', 'lanternfall', 'warhost');
    faction(w, 'warhost').bases = faction(w, 'warhost').bases.filter((b) => b.at !== 'lanternfall');
    faction(w, 'warhost').assets = faction(w, 'warhost').assets.filter(
      (a) => a.at !== 'lanternfall',
    );
    expect(settle(w, data, s)).toBe('fallen');
    expect(holderOf(w, data, 'lanternfall')).toBe('bastion');
  });

  it('gives a town two sieges take at once to the first, the other going on against it', () => {
    const w = factionWorld();
    w.position = { col: 2, row: 2 };
    for (const a of faction(w, 'warhost').assets) a.at = 'lanternfall';
    for (const a of faction(w, 'bastion').assets) a.at = 'lanternfall';
    const first = beginSiege(w, data, 'warhost', 'lanternfall', 'settlements');
    const second = beginSiege(w, data, 'bastion', 'lanternfall', 'settlements');
    free(w).assets = free(w).assets.filter((a) => a.at !== 'lanternfall');
    free(w).bases = free(w).bases.filter((b) => b.at !== 'lanternfall');
    const elsewhere = { ...first, town: 'mirewatch', attacker: 'loyalists' };
    w.sieges.push(elsewhere);
    expect(settle(w, data, first)).toBe('fallen');
    expect(holderOf(w, data, 'lanternfall')).toBe('warhost');
    expect(second.defender).toBe('warhost');
    expect(elsewhere.defender).toBe('settlements');
    // The warhost's new base stands, so the Bastion's siege goes on.
    expect(settle(w, data, second)).toBeNull();
    expect(faction(w, 'bastion').bases.some((b) => b.at === 'lanternfall')).toBe(false);
    // Nor can a second attacker take a town another already holds.
    expect(capture(w, data, 'bastion', 'lanternfall')).toBe(false);
  });
});

const free = (w: World) => faction(w, 'settlements');
