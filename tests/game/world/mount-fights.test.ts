import { describe, expect, it } from 'vitest';
import type { Battle } from '../../../src/game/combat/types.ts';
import { applyBattle, partyBattle } from '../../../src/game/world/fight.ts';
import { calmWarMounts, mountSetups } from '../../../src/game/world/mount-fights.ts';
import { startEncounter } from '../../../src/game/world/encounters.ts';
import { allMounted, buyMount, setRider } from '../../../src/game/world/mounts.ts';
import type { Member, Mount, World } from '../../../src/game/world/types.ts';
import { memberSheet } from '../../../src/game/world/members.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng, scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

/** The starters in Rubblegate with Grukk on a war boar of 20 HP. */
function riding(): { w: World; grukk: Member; boar: Mount } {
  const w = world();
  w.purse = 10000;
  w.rng = scriptedRng([5, 5, 5, 5]);
  buyMount(w, data, 'war-boar');
  const boar = w.mounts[0] as Mount;
  const grukk = member(w, 'Grukk');
  setRider(w, data, boar.id, grukk.id);
  return { w, grukk, boar };
}

const withFocus = (m: Member, level: number) => {
  m.character = { ...m.character, foci: [...m.character.foci, { id: 'rider', level }] };
};

describe('war mounts in overland fights (docs/rules-adaptation.md, Mounts)', () => {
  it("joins when its rider calms it with Cha/Ride against 8, and panics when they don't", () => {
    const { w, boar } = riding();
    w.rng = scriptedRng([6, 6]);
    expect(calmWarMounts(w, data, w.members)).toEqual([boar]);
    w.rng = scriptedRng([1, 2]);
    expect(calmWarMounts(w, data, w.members)).toEqual([]);
    expect(w.log.at(-1)).toContain("War Boar panics and won't be ridden into the fight.");
  });

  it('needs no check from a Rider, whose mount never panics', () => {
    const { w, grukk, boar } = riding();
    withFocus(grukk, 1);
    w.rng = scriptedRng([]);
    expect(calmWarMounts(w, data, w.members)).toEqual([boar]);
  });

  it('stays out with no rider fighting, underground, or as a riding mount', () => {
    const { w, grukk, boar } = riding();
    expect(
      calmWarMounts(
        w,
        data,
        w.members.filter((m) => m !== grukk),
      ),
    ).toEqual([]);
    w.dungeon = {} as World['dungeon'];
    expect(calmWarMounts(w, data, w.members)).toEqual([]);
    w.dungeon = null;
    boar.hp = 0;
    expect(calmWarMounts(w, data, w.members)).toEqual([]);
    const elk = riding();
    elk.w.rng = scriptedRng([5, 5]);
    buyMount(elk.w, data, 'riding-elk');
    setRider(elk.w, data, 'mount-1', member(elk.w, 'Snag').id);
    elk.w.rng = scriptedRng([6, 6]);
    expect(calmWarMounts(elk.w, data, elk.w.members).map((m) => m.type)).toEqual(['war-boar']);
  });

  it("lines up under its rider, with a Rider's AC and guard", () => {
    const { w, grukk, boar } = riding();
    const fighters = w.members;
    expect(mountSetups(w, data, fighters, [boar])).toEqual([
      { monster: 'war-boar', name: 'War Boar', rider: 1, hp: 20, maxHp: 20 },
    ]);
    withFocus(grukk, 2);
    expect(mountSetups(w, data, fighters, [boar])).toEqual([
      {
        monster: 'war-boar',
        name: 'War Boar',
        rider: 1,
        hp: 20,
        maxHp: 20,
        ac: memberSheet(data, grukk).equipment.armorClass,
        guard: true,
      },
    ]);
  });

  it('fights in overland battles but not in the arena', () => {
    const { w } = riding();
    w.rng = scriptedThenRandom([6, 6]);
    const fight = partyBattle(w, data, [['thug-or-militia']], true, null);
    expect(fight.mountIds).toEqual(['mount-0']);
    const c = fight.battle.combatants[fight.memberIds.length] as Battle['combatants'][number];
    expect(c).toMatchObject({ id: 'mount-0', rider: 'pc-1', row: 0, column: 1 });
    expect(fight.setup.mounts).toHaveLength(1);
    const arena = partyBattle(w, data, [['thug-or-militia']], false, null);
    expect(arena.mountIds).toEqual([]);
    expect(arena.setup.mounts).toEqual([]);
  });

  it('brings hit points back, and a slain mount dies with its load', () => {
    const { w, boar } = riding();
    w.rng = scriptedThenRandom([6, 6]);
    const fight = partyBattle(w, data, [['thug-or-militia']], true, null);
    const c = fight.battle.combatants[fight.memberIds.length] as Battle['combatants'][number];
    c.hp = 7;
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'draw', rounds: 1, deaths: 0, battle: fight.battle },
      null,
    );
    expect(boar.hp).toBe(7);
    boar.inventory = [{ id: 'waterskin-one-gallon', quantity: 1, location: 'stowed' }];
    w.rng = scriptedThenRandom([6, 6]);
    const again = partyBattle(w, data, [['thug-or-militia']], true, null);
    const d = again.battle.combatants[again.memberIds.length] as Battle['combatants'][number];
    d.status = 'dead';
    d.hp = 0;
    applyBattle(
      w,
      data,
      again,
      { outcome: 'draw', rounds: 1, deaths: 0, battle: again.battle },
      null,
    );
    expect(w.mounts).toEqual([]);
    expect(w.log).toContain(`Day 1, morning: War Boar dies, and its load is lost.`);
  });

  it('says nothing of a load when a slain mount carried none', () => {
    const { w } = riding();
    w.rng = scriptedThenRandom([6, 6]);
    const fight = partyBattle(w, data, [['thug-or-militia']], true, null);
    const c = fight.battle.combatants[fight.memberIds.length] as Battle['combatants'][number];
    c.hp = 0;
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'draw', rounds: 1, deaths: 0, battle: fight.battle },
      null,
    );
    expect(w.mounts).toEqual([]);
    expect(w.log).toContain(`Day 1, morning: War Boar dies.`);
  });

  it('keeps mounts and pack beasts when a lost fight sends the party to town', () => {
    const { w } = riding();
    w.rng = scriptedRng([4, 4]);
    buyMount(w, data, 'pack-bison');
    w.rng = scriptedThenRandom([1, 1, 1, 1]);
    const fight = partyBattle(w, data, [['thug-or-militia']], true, null);
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'enemy', rounds: 1, deaths: 0, battle: fight.battle },
      null,
    );
    expect(w.mounts).toHaveLength(1);
    expect(w.npcs.map((n) => n.kind)).toEqual(['pack']);
  });
});

const scriptedThenRandom = (faces: number[]) => scriptedThen(faces, createRng('fights'));

describe('slipping away mounted (docs/rules-adaptation.md, Mounts)', () => {
  /** Meets a thug with Lirael watching: reaction 3+3, the thug 4+4, Lirael 3+3. */
  const meet = (w: World) => {
    w.rng = scriptedThenRandom([3, 3, 4, 4, 3, 3]);
    startEncounter(
      w,
      data,
      { rows: [['thug-or-militia']], nature: 'hostile', captive: null },
      member(w, 'Lirael'),
      0,
      'here',
    );
    return w.encounter?.spotted;
  };

  it('gives the watcher +2 when every living PC rides or is a centaur', () => {
    const w = world();
    expect(meet(w)).toBe(false);
    w.encounter = null;
    const lirael = member(w, 'Lirael');
    for (const m of w.members)
      if (m !== lirael) m.character = { ...m.character, people: 'centaur', lineage: 'bison' };
    expect(allMounted(w, data)).toBe(false);
    w.purse = 1000;
    w.rng = scriptedRng([4, 4]);
    buyMount(w, data, 'riding-elk');
    setRider(w, data, 'mount-0', lirael.id);
    expect(allMounted(w, data)).toBe(true);
    expect(meet(w)).toBe(true);
  });
});
