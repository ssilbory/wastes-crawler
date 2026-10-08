import { describe, expect, it } from 'vitest';
import { endOfDay } from '../../../src/game/world/day.ts';
import { carriers, stowWith, takeFrom } from '../../../src/game/world/loads.ts';
import {
  allMounted,
  buyMount,
  keepAsMount,
  load,
  mountCapacity,
  mountOf,
  mountPrice,
  mountSellPrice,
  mountType,
  nightForMounts,
  releaseMount,
  rides,
  riderOf,
  sellMount,
  setRider,
  tamers,
  tamesInto,
} from '../../../src/game/world/mounts.ts';
import { fights, npcMonster } from '../../../src/game/world/npcs.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { WORLD_MIGRATIONS } from '../../../src/game/world/save-migrations.ts';
import type { Member, Mount, World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from './helpers.ts';

/** The starters in Rubblegate with crowns to spend and scripted dice. */
function town(faces: number[] = []): World {
  const w = world(faces);
  w.purse = 5000;
  return w;
}

/** A mount bought in town with the given hit dice faces. */
function bought(w: World, type: string): Mount {
  expect(buyMount(w, data, type)).toEqual({ ok: true });
  return w.mounts.at(-1) as Mount;
}

const centaur = (m: Member) => {
  m.character = { ...m.character, people: 'centaur', lineage: 'bison' };
};

describe('buying and selling mounts (SRD 3.2.0; docs/rules-adaptation.md, Mounts)', () => {
  it('buys a riding mount at its price, with 1d8 hit points per hit die', () => {
    const w = town([5, 3]);
    const price = mountPrice(w, data, 'riding-elk');
    const m = bought(w, 'riding-elk');
    expect(m).toEqual({
      id: 'mount-0',
      type: 'riding-elk',
      name: 'Riding Elk',
      hp: 8,
      maxHp: 8,
      rider: null,
      inventory: [],
    });
    expect(w.purse).toBe(5000 - price);
    expect(w.npcs).toEqual([]);
    // A second of the kind gets its own name and id.
    w.rng = { ...w.rng, int: () => 1 };
    expect(bought(w, 'riding-elk')).toMatchObject({ id: 'mount-1', name: 'Riding Elk 2' });
  });

  it('puts a pack beast in an NPC slot, which needs room', () => {
    const w = town([4, 4, 4, 4, 4, 4]);
    expect(buyMount(w, data, 'pack-bison')).toEqual({ ok: true });
    const pack = w.npcs[0];
    expect(pack).toMatchObject({ kind: 'pack', type: 'pack-bison', name: 'Pack Bison', hp: 8 });
    expect(w.mounts).toEqual([]);
    // A pack beast never fights, and draws its stat line from its mount type.
    expect(fights(data, pack as World['npcs'][number])).toBe(false);
    expect(npcMonster(data, pack as World['npcs'][number]).name).toBe('Pack Bison');
    buyMount(w, data, 'pack-bison');
    expect(buyMount(w, data, 'pack-bison')).toEqual({
      ok: false,
      reason: 'There is no room in the party.',
    });
  });

  it('refuses without the crowns, or during an encounter', () => {
    const w = town();
    w.purse = 10;
    expect(buyMount(w, data, 'riding-elk')).toEqual({
      ok: false,
      reason: `That costs ${mountPrice(w, data, 'riding-elk')} crowns.`,
    });
    w.purse = 5000;
    expect(() => buyMount(w, data, 'warhorse')).toThrow('unknown mount warhorse');
    w.encounter = encounter([['thug-or-militia']]);
    expect(buyMount(w, data, 'riding-elk')).toMatchObject({ ok: false });
  });

  it('sells a mount back at the sell fraction once its load is off', () => {
    const w = town([4, 4]);
    const m = bought(w, 'riding-goat');
    m.inventory = [{ id: 'waterskin-one-gallon', quantity: 1, location: 'stowed' }];
    expect(sellMount(w, data, m.id)).toEqual({
      ok: false,
      reason: "Take Riding Goat's load first.",
    });
    m.inventory = [];
    const purse = w.purse;
    const price = mountSellPrice(w, data, 'riding-goat');
    expect(price).toBeGreaterThanOrEqual(15);
    expect(sellMount(w, data, m.id)).toEqual({ ok: true });
    expect(w.purse).toBe(purse + price);
    expect(w.mounts).toEqual([]);
    expect(() => sellMount(w, data, 'npc-0')).toThrow('no mount npc-0');
  });

  it('sets a mount loose anywhere above ground', () => {
    const w = town([4, 4, 4, 4]);
    const m = bought(w, 'riding-elk');
    buyMount(w, data, 'pack-bison');
    w.dungeon = {} as World['dungeon'];
    expect(releaseMount(w, data, m.id)).toEqual({
      ok: false,
      reason: 'The mounts wait at the entrance.',
    });
    // A pack beast goes underground with the party, so it can be let go there.
    expect(releaseMount(w, data, 'npc-0')).toEqual({ ok: true });
    w.dungeon = null;
    expect(releaseMount(w, data, m.id)).toEqual({ ok: true });
    expect(w.mounts).toEqual([]);
    expect(w.log.at(-1)).toContain('Riding Elk is set loose');
  });
});

describe('riders (docs/rules-adaptation.md, Mounts)', () => {
  it('lets small mounts carry only Goblins and Gnomes, and centaurs ride nothing', () => {
    const w = town([4, 4, 4, 4]);
    const goat = bought(w, 'riding-goat');
    const elk = bought(w, 'riding-elk');
    const grukk = member(w, 'Grukk');
    expect(setRider(w, data, goat.id, grukk.id)).toEqual({
      ok: false,
      reason: "Riding Goat can't carry Grukk.",
    });
    expect(setRider(w, data, goat.id, member(w, 'Snag').id)).toEqual({ ok: true });
    expect(rides(data, member(w, 'Fizzwick'), mountType(data, 'riding-goat'))).toBe(true);
    centaur(grukk);
    expect(setRider(w, data, elk.id, grukk.id)).toEqual({
      ok: false,
      reason: 'Grukk is a centaur and rides no one.',
    });
    expect(rides(data, grukk, mountType(data, 'riding-elk'))).toBe(false);
  });

  it('moves a rider from one mount to another, and takes them off', () => {
    const w = town([4, 4, 4, 4]);
    const goat = bought(w, 'riding-goat');
    const elk = bought(w, 'riding-elk');
    const snag = member(w, 'Snag');
    setRider(w, data, goat.id, snag.id);
    expect(setRider(w, data, elk.id, snag.id)).toEqual({ ok: true });
    expect(goat.rider).toBeNull();
    expect(mountOf(w, snag.id)).toBe(elk);
    expect(setRider(w, data, elk.id, null)).toEqual({ ok: true });
    expect(mountOf(w, snag.id)).toBeUndefined();
    expect(() => setRider(w, data, 'mount-9', null)).toThrow('no mount mount-9');
  });

  it('carries less with a rider, and refuses a rider while overloaded', () => {
    const w = town([4, 4]);
    const goat = bought(w, 'riding-goat');
    const snag = member(w, 'Snag');
    expect(mountCapacity(w, data, goat)).toBe(15);
    goat.inventory = [{ id: 'waterskin-one-gallon', quantity: 4, location: 'stowed' }];
    expect(load(data, goat)).toBe(4);
    expect(setRider(w, data, goat.id, snag.id)).toEqual({
      ok: false,
      reason: 'Riding Goat carries too much to take a rider; lighten it to 3.',
    });
    goat.inventory = [{ id: 'waterskin-one-gallon', quantity: 3, location: 'stowed' }];
    expect(setRider(w, data, goat.id, snag.id)).toEqual({ ok: true });
    expect(mountCapacity(w, data, goat)).toBe(3);
    // A dead rider leaves the mount unridden.
    snag.dead = true;
    expect(riderOf(w, goat)).toBeUndefined();
    expect(mountCapacity(w, data, goat)).toBe(15);
  });

  it('changes riders only above ground and out of encounters', () => {
    const w = town([4, 4]);
    const elk = bought(w, 'riding-elk');
    w.encounter = encounter([['thug-or-militia']]);
    expect(setRider(w, data, elk.id, member(w, 'Grukk').id)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    w.encounter = null;
    w.dungeon = {} as World['dungeon'];
    expect(setRider(w, data, elk.id, null)).toMatchObject({ ok: false });
  });

  it('counts the party mounted when every living PC rides or is a centaur', () => {
    const w = town(Array<number>(8).fill(4));
    expect(allMounted(w, data)).toBe(false);
    const [snag, grukk, lirael, fizzwick] = w.members as [Member, Member, Member, Member];
    setRider(w, data, bought(w, 'riding-goat').id, snag.id);
    setRider(w, data, bought(w, 'riding-elk').id, grukk.id);
    setRider(w, data, bought(w, 'riding-elk').id, fizzwick.id);
    expect(allMounted(w, data)).toBe(false);
    centaur(lirael);
    expect(allMounted(w, data)).toBe(true);
    // The dead don't hold the party back; underground no one rides.
    fizzwick.dead = true;
    expect(allMounted(w, data)).toBe(true);
    w.dungeon = {} as World['dungeon'];
    expect(allMounted(w, data)).toBe(false);
  });
});

describe('mount loads (SRD 2.12.3)', () => {
  it('carries gear like a porter, up to its load, and not underground', () => {
    const w = town([4, 4]);
    const goat = bought(w, 'riding-goat');
    const snag = member(w, 'Snag');
    setRider(w, data, goat.id, snag.id);
    snag.character = {
      ...snag.character,
      inventory: [
        ...snag.character.inventory,
        { id: 'waterskin-one-gallon', quantity: 4, location: 'stowed' },
      ],
    };
    const rope = snag.character.inventory.length - 1;
    for (let i = 0; i < 3; i++)
      expect(stowWith(w, data, snag.id, rope, goat.id)).toEqual({ ok: true });
    expect(stowWith(w, data, snag.id, rope, goat.id)).toEqual({
      ok: false,
      reason: "Riding Goat can't carry any more.",
    });
    expect(goat.inventory).toEqual([
      { id: 'waterskin-one-gallon', quantity: 3, location: 'stowed' },
    ]);
    expect(takeFrom(w, data, goat.id, 0, snag.id)).toEqual({ ok: true });
    expect(goat.inventory[0]?.quantity).toBe(2);
    expect(carriers(w, data).map((c) => c.kind)).toEqual(['mount']);
    w.dungeon = {} as World['dungeon'];
    expect(carriers(w, data)).toEqual([]);
    expect(() => takeFrom(w, data, goat.id, 0, snag.id)).toThrow('no carrier mount-0');
  });

  it('gives a pack beast its unridden load', () => {
    const w = town([4, 4]);
    buyMount(w, data, 'pack-bison');
    expect(carriers(w, data)).toMatchObject([{ kind: 'pack', capacity: 30 }]);
  });
});

describe('mounts at night', () => {
  it('heal their hit dice on a rested night, and nothing otherwise', () => {
    const w = town([4, 4]);
    const elk = bought(w, 'riding-elk');
    elk.hp = 3;
    nightForMounts(w, data, false);
    expect(elk.hp).toBe(3);
    nightForMounts(w, data, true);
    expect(elk.hp).toBe(5);
    nightForMounts(w, data, true);
    nightForMounts(w, data, true);
    expect(elk.hp).toBe(8);
  });

  it('heal through the end of a day in town, and eat nothing', () => {
    const w = town([4, 4]);
    const elk = bought(w, 'riding-elk');
    elk.hp = 1;
    const rations = w.rations;
    w.rng = { ...w.rng, int: (min: number) => min };
    endOfDay(w, data);
    expect(elk.hp).toBe(3);
    expect(w.rations).toBe(rations);
  });
});

describe('taming (docs/rules-adaptation.md, Mounts: Taming)', () => {
  it('maps a herd beast to the riding aurochs', () => {
    expect(tamesInto(data, 'herd-beast')?.id).toBe('riding-aurochs');
    expect(tamesInto(data, 'thug-or-militia')).toBeUndefined();
  });

  it('keeps an offered beast as a mount for its rations, ridden by its tamer', () => {
    const w = town([4, 4]);
    const snag = member(w, 'Snag');
    expect(tamers(w, data)).toEqual([]);
    snag.character = { ...snag.character, skills: { ...snag.character.skills, 'animal-ken': 0 } };
    w.encounter = encounter([['herd-beast']], { beast: 'herd-beast' });
    w.rations = 4;
    expect(keepAsMount(w, data, snag.id)).toEqual({
      ok: false,
      reason: 'Taming it takes 2 steps of the rations die.',
    });
    w.rations = 12;
    expect(keepAsMount(w, data, member(w, 'Grukk').id)).toEqual({
      ok: false,
      reason: 'Choose someone awake with Animal Ken.',
    });
    expect(keepAsMount(w, data, snag.id)).toEqual({ ok: true });
    expect(w.rations).toBe(8);
    expect(w.encounter.beast).toBeUndefined();
    expect(w.mounts).toMatchObject([{ type: 'riding-aurochs', rider: snag.id }]);
    expect(w.npcs).toEqual([]);
    expect(keepAsMount(w, data, snag.id)).toEqual({
      ok: false,
      reason: 'No beast here would carry a rider.',
    });
  });

  it("leaves a tamed mount unridden when the tamer can't ride it", () => {
    const w = town([4, 4]);
    const grukk = member(w, 'Grukk');
    centaur(grukk);
    grukk.character = {
      ...grukk.character,
      skills: { ...grukk.character.skills, 'animal-ken': 1 },
    };
    w.encounter = encounter([['herd-beast']], { beast: 'herd-beast' });
    expect(keepAsMount(w, data, grukk.id)).toEqual({ ok: true });
    expect(w.mounts[0]?.rider).toBeNull();
  });
});

describe('saving mounts', () => {
  it('round-trips mounts and pack beasts', () => {
    const w = town([4, 4, 4, 4]);
    const elk = bought(w, 'riding-elk');
    setRider(w, data, elk.id, member(w, 'Grukk').id);
    buyMount(w, data, 'pack-bison');
    w.rng = world().rng;
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.mounts).toEqual(w.mounts);
    expect(back.ok && back.world.npcs).toEqual(w.npcs);
  });

  it('gives version 30 saves no mounts', () => {
    expect(WORLD_MIGRATIONS[30]?.({ schemaVersion: 30 })).toEqual({
      schemaVersion: 31,
      mounts: [],
    });
  });
});
