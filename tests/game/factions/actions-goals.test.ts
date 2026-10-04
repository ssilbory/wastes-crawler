import { describe, expect, it } from 'vitest';
import {
  assetCost,
  attackAction,
  createAction,
  isHurt,
  moveAction,
  readyAttackers,
  repairAction,
  victimAt,
} from '../../../src/game/factions/actions.ts';
import { checkGoal, pickGoal, weakestBase } from '../../../src/game/factions/goals.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, faction, factionWorld, held } from './helpers.ts';

describe('faction actions (6.6.0)', () => {
  it('finds the rival that answers an attack: the goal target first, then rivals in order', () => {
    const w = factionWorld();
    const bastion = faction(w, 'bastion');
    held(w, 'warhost', 'infantry').at = 'lanternfall';
    expect(victimAt(w, data, 'bastion', 'lanternfall')).toBe('warhost');
    bastion.goal = {
      kind: 'root-out',
      target: { faction: 'settlements', at: 'lanternfall' },
      progress: 0,
    };
    expect(victimAt(w, data, 'bastion', 'lanternfall')).toBe('settlements');
    expect(victimAt(w, data, 'bastion', 'dawnwall')).toBeNull();
    expect(readyAttackers(w, data, 'bastion')).toEqual([]);
    held(w, 'bastion', 'infantry').at = 'lanternfall';
    expect(readyAttackers(w, data, 'bastion')).toHaveLength(1);
  });

  it('attacks with every ready asset, skipping any lost or left without a target', () => {
    const w = factionWorld();
    const s = faction(w, 'warhost');
    for (const a of s.assets) a.at = 'lanternfall';
    // The band hits the farm at Lanternfall for 8 and kills it, the pack razes the 2-hp base with
    // 2d4, and the guards find nothing left.
    w.rng = scriptedRng([10, 1, 1, 8, 10, 1, 1, 3, 2]);
    const hits: string[] = [];
    attackAction(w, data, 'warhost', (victim, at, r) => hits.push(`${victim}@${at}:${r.dealt}`));
    expect(hits).toEqual(['settlements@lanternfall:4', 'settlements@lanternfall:2']);
    expect(faction(w, 'settlements').bases.some((b) => b.at === 'lanternfall')).toBe(false);
  });

  it('repairs the faction once and each hurt asset once while Treasure lasts', () => {
    const w = factionWorld();
    const s = faction(w, 'warhost');
    expect(isHurt(data, s)).toBe(false);
    s.hp = 10;
    s.treasure = 2;
    const band = held(w, 'warhost', 'infantry');
    const pack = held(w, 'warhost', 'scouts');
    band.hp = 1;
    pack.hp = 1;
    expect(isHurt(data, s)).toBe(true);
    repairAction(data, s);
    // Force 6, Cunning 2, Wealth 4: the faction heals (6 + 2) / 2 = 4; the band half of Force, 3.
    expect(s.hp).toBe(14);
    expect(band.hp).toBe(4);
    expect(pack.hp).toBe(1);
    expect(s.treasure).toBe(0);
    s.treasure = 5;
    s.hp = 19;
    band.hp = 6;
    repairAction(data, s);
    expect(s.hp).toBe(20);
    expect(pack.hp).toBe(4);
    expect(s.treasure).toBe(3);
    s.assets = [];
    s.hp = 20;
    expect(isHurt(data, s)).toBe(false);
  });

  it('prices assets with Populist, and buys the dearest it can at home', () => {
    const w = factionWorld();
    expect(assetCost(data, 'settlements', 'local-guard')).toBe(2);
    expect(assetCost(data, 'settlements', 'armed-guards')).toBe(1);
    expect(assetCost(data, 'settlements', 'manufactory')).toBe(8);
    expect(assetCost(data, 'warhost', 'local-guard')).toBe(3);
    const s = faction(w, 'warhost');
    s.treasure = 6;
    expect(createAction(w, data, 'warhost', true)).toBe(true);
    expect(s.assets.at(-1)).toMatchObject({ asset: 'infantry', at: 'grisks-hold', hp: 6 });
    expect(s.treasure).toBe(0);
    expect(w.log.at(-1)).toContain("Grisk's Warhost raises Beastman Warband at Grisk's Hold.");
    expect(createAction(w, data, 'warhost', true)).toBe(false);
    // Nothing armed it can buy: something else instead.
    s.treasure = 1;
    s.force = 2;
    expect(createAction(w, data, 'warhost', true)).toBe(true);
    expect(s.assets.at(-1)?.asset).toBe('armed-guards');
  });

  it('builds at its first base without an HQ, the least-held one in peace, and not at all homeless', () => {
    const w = factionWorld();
    const s = faction(w, 'settlements');
    s.goal = { kind: 'peaceable-kingdom', target: null, progress: 0 };
    s.treasure = 1;
    // Lanternfall and Mirewatch each hold one farm, Gutterwick a watch, Cinderhold a watch.
    s.assets = s.assets.filter((a) => a.at !== 'mirewatch');
    createAction(w, data, 'settlements', false);
    expect(s.assets.at(-1)?.at).toBe('mirewatch');
    s.goal = null;
    s.bases = s.bases.filter((b) => b.at !== 'cinderhold');
    s.treasure = 1;
    createAction(w, data, 'settlements', false);
    expect(s.assets.at(-1)?.at).toBe('gutterwick');
    s.bases = [];
    s.treasure = 99;
    expect(createAction(w, data, 'settlements', false)).toBe(false);
  });

  it('marches its fighters on a location', () => {
    const w = factionWorld();
    moveAction(w, data, 'warhost', 'cinderhold');
    expect(faction(w, 'warhost').assets.map((a) => a.at)).toEqual([
      'cinderhold',
      'cinderhold',
      'cinderhold',
      'grisks-hold',
    ]);
    expect(w.log.at(-1)).toContain("Grisk's Warhost marches on Cinderhold.");
    const lines = w.log.length;
    moveAction(w, data, 'warhost', 'cinderhold');
    expect(w.log).toHaveLength(lines);
  });
});

describe('faction goals and experience (6.7.0)', () => {
  it('roots out the weakest rival base, or keeps the peace with none left', () => {
    const w = factionWorld();
    expect(weakestBase(w, data, 'bastion')).toEqual({ faction: 'settlements', at: 'lanternfall' });
    pickGoal(w, data, 'bastion', 0);
    expect(faction(w, 'bastion').goal).toEqual({
      kind: 'root-out',
      target: { faction: 'settlements', at: 'lanternfall' },
      progress: 0,
    });
    for (const id of ['warhost', 'settlements', 'loyalists']) faction(w, id).hp = 0;
    expect(weakestBase(w, data, 'bastion')).toBeNull();
    pickGoal(w, data, 'bastion', 0);
    expect(faction(w, 'bastion').goal?.kind).toBe('blood-the-enemy');
    expect(faction(w, 'bastion').goalIndex).toBe(1);
    const onlyRootOut = {
      ...data,
      content: {
        ...data.content,
        factions: {
          ...data.content.factions,
          factions: data.content.factions.factions.map((f) =>
            f.id === 'bastion' ? { ...f, goals: ['root-out' as const] } : f,
          ),
        },
      },
    };
    pickGoal(w, onlyRootOut, 'bastion', 0);
    expect(faction(w, 'bastion').goal?.kind).toBe('peaceable-kingdom');
  });

  it('pays experience for each goal met and raises attributes in order', () => {
    const w = factionWorld();
    const s = faction(w, 'warhost');
    pickGoal(w, data, 'warhost', 0);
    s.goal = { kind: 'blood-the-enemy', target: null, progress: 11 };
    expect(checkGoal(w, data, 'warhost', true)).toBe(false);
    s.goal.progress = 12;
    s.xp = 14;
    expect(checkGoal(w, data, 'warhost', true)).toBe(true);
    // 16 XP raises Force from 6 to 7, adding 4 hit points to the faction and its HQ.
    expect(s).toMatchObject({ force: 7, xp: 0, hp: 24 });
    expect(s.bases[0]).toMatchObject({ hp: 24, max: 24 });
    expect(s.goal?.kind).toBe('root-out');
    expect(w.log.join('\n')).toContain("Grisk's Warhost achieves its goal, Blood the Enemy.");
  });

  it('roots out its target for half the ruler average, rounded up, or gives it up', () => {
    const w = factionWorld();
    const s = faction(w, 'bastion');
    pickGoal(w, data, 'bastion', 0);
    expect(checkGoal(w, data, 'bastion', true)).toBe(false);
    (s.goal as { progress: number }).progress = 1;
    expect(checkGoal(w, data, 'bastion', true)).toBe(true);
    // The settlements average (4 + 2 + 5) / 3: half of it rounds up to 2.
    expect(s.xp).toBe(2);
    pickGoal(w, data, 'bastion', 0);
    faction(w, 'settlements').bases = faction(w, 'settlements').bases.filter(
      (b) => b.at !== 'lanternfall',
    );
    expect(checkGoal(w, data, 'bastion', false)).toBe(false);
    expect(s.idle).toBe(true);
    expect(s.goal?.kind).toBe('blood-the-enemy');
    expect(w.log.at(-1)).toContain('The Dawnwall Bastion gives up on Lanternfall.');
    // A collapsed target is given up too.
    pickGoal(w, data, 'bastion', 0);
    delete w.factions.settlements;
    expect(checkGoal(w, data, 'bastion', false)).toBe(false);
  });

  it('keeps the peace for four turns without an Attack, and stops raising at 8', () => {
    const w = factionWorld();
    const s = faction(w, 'settlements');
    pickGoal(w, data, 'settlements', 0);
    for (let i = 0; i < 3; i++) expect(checkGoal(w, data, 'settlements', false)).toBe(false);
    expect(checkGoal(w, data, 'settlements', true)).toBe(false);
    expect(s.goal?.progress).toBe(0);
    for (let i = 0; i < 3; i++) checkGoal(w, data, 'settlements', false);
    s.force = 8;
    s.cunning = 8;
    s.wealth = 8;
    s.xp = 50;
    expect(checkGoal(w, data, 'settlements', false)).toBe(true);
    expect(s.xp).toBe(51);
    // Without its HQ base, raising only lifts the faction.
    const l = faction(w, 'loyalists');
    l.bases = [];
    l.xp = 8;
    pickGoal(w, data, 'loyalists', 0);
    (l.goal as { progress: number }).progress = 99;
    checkGoal(w, data, 'loyalists', true);
    // Blood pays 2: 9 of the 10 XP raise Cunning from 4 to 5, worth 3 more hit points.
    expect(l).toMatchObject({ cunning: 5, xp: 1, hp: 14 });
  });
});
