import { describe, expect, it } from 'vitest';
import { inSlot } from '../../../src/game/combat/mounted.ts';
import type { Combatant } from '../../../src/game/combat/types.ts';
import { waitingSetup } from '../../../src/game/world/companion-fight.ts';
import {
  dismountForDungeon,
  remountOnSurface,
  rideCompanion,
  riddenBy,
  rideProblem,
  stepDown,
} from '../../../src/game/world/companion-mounts.ts';
import { nightForCompanions } from '../../../src/game/world/companion-night.ts';
import { followMaster, sharedEyes } from '../../../src/game/world/companion-sync.ts';
import {
  callCompanion,
  companionHere,
  sendAway,
  swiftHealing,
} from '../../../src/game/world/companions.ts';
import { applyBattle, encounterBattle, type WorldBattle } from '../../../src/game/world/fight.ts';
import { allMounted, buyMount, setRider } from '../../../src/game/world/mounts.ts';
import { addNpc, MAX_NPCS } from '../../../src/game/world/npcs.ts';
import type { Member, Mount, Npc, World } from '../../../src/game/world/types.ts';
import { companionsView } from '../../../src/render/companions-view.ts';
import { beastmaster } from '../beastmaster.ts';
import { data, encounter, member, world } from './helpers.ts';

const fail = (reason: string) => ({ ok: false, reason });

/** Snag (a Goblin) as a level 3 Ranger with the given arts. */
function ranger(w: World, arts: string[] = []): Member {
  const m = member(w, 'Snag');
  m.character = { ...beastmaster(arts, 3), id: m.character.id, hp: { max: 20, current: 20 } };
  return m;
}

/** Bramble, Snag's companion in the party: a herd beast unless `type` says otherwise. */
function bramble(w: World, m: Member, type = 'herd-beast', over: Partial<Npc> = {}): Npc {
  const n = addNpc(w, data, 'companion', type, type, 'Bramble', true) as Npc;
  Object.assign(n, { master: m.id, hp: 9, maxHp: 9, ...over });
  return n;
}

/** Snag riding Bramble. */
function riding(over: Partial<Npc> = {}, arts: string[] = []): { w: World; m: Member } {
  const w = world();
  const m = ranger(w, arts);
  bramble(w, m, 'herd-beast', over);
  expect(rideCompanion(w, data, m.id)).toEqual({ ok: true });
  return { w, m };
}

const won = (fight: WorldBattle) => ({
  outcome: 'party' as const,
  rounds: 2,
  deaths: 0,
  battle: fight.battle,
});

describe('riding a companion (docs/rules-adaptation.md, Mounts: Sam’s call)', () => {
  it('takes it out of the NPC slots and counts as the master’s mount', () => {
    const { w, m } = riding();
    expect(w.npcs).toEqual([]);
    expect(riddenBy(w, m)).toMatchObject({ name: 'Bramble', ridden: true });
    expect(w.log.at(-1)).toContain('Snag rides Bramble.');
    // The freed slot takes another NPC.
    for (let i = 0; i < MAX_NPCS; i++)
      expect(addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, true)).not.toBeNull();
  });

  it('takes the rider off a bought mount, and a bought mount refuses them after', () => {
    const w = world();
    w.purse = 10000;
    const m = ranger(w);
    buyMount(w, data, 'riding-goat');
    const goat = w.mounts[0] as Mount;
    buyMount(w, data, 'riding-elk');
    setRider(w, data, goat.id, m.id);
    bramble(w, m);
    rideCompanion(w, data, m.id);
    expect(goat.rider).toBeNull();
    expect(w.mounts[1]?.rider).toBeNull();
    expect(setRider(w, data, goat.id, m.id)).toEqual(fail('Snag rides Bramble; get down first.'));
  });

  it('counts the rider as mounted for slipping away', () => {
    const { w } = riding();
    w.members = w.members.filter((x) => x.character.name === 'Snag');
    expect(allMounted(w, data)).toBe(true);
  });

  it('refuses beasts off the list, riders too big, centaurs, the hurt, and bad moments', () => {
    const w = world();
    const m = ranger(w);
    expect(rideProblem(w, data, m)).toBe("Snag's companion isn't with the party.");
    const n = bramble(w, m, 'giant-rattlesnake');
    expect(rideProblem(w, data, m)).toBe("Bramble can't carry Snag.");
    n.type = 'dire-wolf';
    expect(rideProblem(w, data, m)).toBeNull();
    m.character = { ...m.character, people: 'orc' };
    expect(rideProblem(w, data, m)).toBe("Bramble can't carry Snag.");
    m.character = { ...m.character, people: 'centaur' };
    expect(rideProblem(w, data, m)).toBe('Snag is a centaur and rides no one.');
    m.character = { ...m.character, people: 'goblin' };
    n.hp = 0;
    expect(rideProblem(w, data, m)).toBe('Bramble is in no state to carry anyone.');
    n.hp = 9;
    w.dungeon = {} as World['dungeon'];
    expect(rideProblem(w, data, m)).toBe('There is no riding Bramble underground.');
    w.dungeon = null;
    w.encounter = encounter([['human-raider']]);
    expect(rideCompanion(w, data, m.id)).toEqual(fail('Deal with the encounter first.'));
    w.encounter = null;
    m.dead = true;
    expect(rideProblem(w, data, m)).toBe('Snag is dead.');
    expect(() => rideCompanion(w, data, 'nobody')).toThrow();
  });

  it('gets down into a free NPC slot, or not without one', () => {
    const { w, m } = riding();
    for (let i = 0; i < MAX_NPCS; i++)
      addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, true);
    expect(stepDown(w, m.id)).toEqual(fail('There is no room in the party for Bramble afoot.'));
    w.npcs.pop();
    w.encounter = encounter([['human-raider']]);
    expect(stepDown(w, m.id)).toEqual(fail('Deal with the encounter first.'));
    w.encounter = null;
    expect(stepDown(w, m.id)).toEqual({ ok: true });
    expect(companionHere(w, m.id)?.ridden).toBeUndefined();
    expect(m.companion).toBeNull();
    expect(stepDown(w, m.id)).toEqual(fail("Snag isn't riding a companion."));
    expect(() => stepDown(w, 'nobody')).toThrow();
  });

  it('is sent away, but not called, and can be tended with Swift Healing', () => {
    const { w, m } = riding({ hp: 3 }, ['swift-healing']);
    expect(callCompanion(w, data, m.id)).toEqual(fail('Snag has no companion waiting.'));
    expect(swiftHealing(w, data, m.id)).toEqual({ ok: true });
    expect(m.companion?.hp).toBeGreaterThan(3);
    expect(sendAway(w, m.id)).toEqual({ ok: true });
    expect(m.companion?.ridden).toBeUndefined();
    expect(callCompanion(w, data, m.id)).toEqual({ ok: true });
  });

  it('keeps its eyes for the party and isn’t waiting for a howl', () => {
    const { w, m } = riding({}, ['eyes-of-the-beast']);
    expect(sharedEyes(w, data)?.name).toBe('Bramble');
    expect(waitingSetup(data, m)).toBeNull();
  });

  it('goes with its master to the tavern, waiting', () => {
    const { w, m } = riding();
    followMaster(w, m);
    expect(m.companion?.ridden).toBeUndefined();
    expect(w.log.at(-1)).toContain('Bramble goes with Snag.');
  });

  it('shows in the panel as carrying its master, with Ride offered only on foot', () => {
    const w = world();
    const m = ranger(w);
    bramble(w, m);
    expect(companionsView(w, data)[0]).toMatchObject({
      canRide: true,
      companion: { where: 'party' },
    });
    rideCompanion(w, data, m.id);
    expect(companionsView(w, data)[0]).toMatchObject({
      canRide: false,
      companion: { where: 'ridden' },
    });
  });
});

describe('a ridden companion in a fight', () => {
  it('fights from its master’s slot without a check, holding no slot of its own', () => {
    const { w, m } = riding();
    w.encounter = encounter([['human-raider']]);
    const fight = encounterBattle(w, data);
    expect(fight.riddenIds).toEqual([m.id]);
    const pet = fight.battle.combatants.find((c) => c.name === 'Bramble') as Combatant;
    const snag = fight.battle.combatants[0] as Combatant;
    expect(pet.rider).toBe(snag.id);
    expect(pet.companion?.master).toBe(snag.id);
    expect(inSlot(pet)).toBe(false);
    expect([pet.row, pet.column]).toEqual([snag.row, snag.column]);
  });

  it('sits out under an unconscious master', () => {
    const { w, m } = riding();
    m.character = { ...m.character, hp: { ...m.character.hp, current: 0 } };
    w.encounter = encounter([['human-raider']]);
    const fight = encounterBattle(w, data);
    expect(fight.riddenIds).toEqual([]);
    expect(fight.battle.combatants.some((c) => c.name === 'Bramble')).toBe(false);
  });

  it('brings its hit points back, a stabilized one with 1', () => {
    for (const [status, hp, want] of [
      ['active', 4, 4],
      ['stable', 0, 1],
    ] as const) {
      const { w, m } = riding();
      w.encounter = encounter([['human-raider']]);
      const fight = encounterBattle(w, data);
      const pet = fight.battle.combatants.find((c) => c.name === 'Bramble') as Combatant;
      Object.assign(pet, { status, hp });
      fight.battle.outcome = 'party';
      applyBattle(w, data, fight, won(fight), null);
      expect(riddenBy(w, m)?.hp).toBe(want);
    }
  });

  it('sends a fallen Chosen Friend away until dawn, and buries any other', () => {
    for (const chosen of [true, false]) {
      const { w, m } = riding(chosen ? { chosen: true } : {});
      w.encounter = encounter([['human-raider']]);
      const fight = encounterBattle(w, data);
      const pet = fight.battle.combatants.find((c) => c.name === 'Bramble') as Combatant;
      pet.status = 'dead';
      fight.battle.outcome = 'party';
      applyBattle(w, data, fight, won(fight), null);
      expect(m.companion?.hp).toBe(chosen ? 0 : undefined);
      expect(m.companion?.ridden).toBeUndefined();
      expect(w.log.some((l) => l.includes(chosen ? 'fades away' : 'Bramble dies.'))).toBe(true);
    }
  });

  it('flees into the wilds when the party falls', () => {
    const { w, m } = riding();
    w.encounter = encounter([['human-raider']]);
    const fight = encounterBattle(w, data);
    fight.battle.outcome = 'enemy';
    applyBattle(w, data, fight, { ...won(fight), outcome: 'enemy' }, null);
    expect(m.companion).toMatchObject({ name: 'Bramble' });
    expect(m.companion?.ridden).toBeUndefined();
    expect(w.log.some((l) => l.endsWith('Bramble flees into the wilds.'))).toBe(true);
  });
});

describe('a ridden companion through the night and underground', () => {
  it('heals its hit dice on a sheltered night only', () => {
    const { w, m } = riding({ hp: 3 });
    nightForCompanions(w, data, false);
    expect(m.companion?.hp).toBe(3);
    nightForCompanions(w, data, true);
    expect(m.companion?.hp).toBe(5);
    expect(m.companion?.ridden).toBe(true);
  });

  it('goes off to wait when its master is dead', () => {
    const { w, m } = riding({ hp: 3 });
    m.dead = true;
    nightForCompanions(w, data, true);
    expect(m.companion?.ridden).toBeUndefined();
    expect(w.log.some((l) => l.endsWith('Bramble slips away to wait for Snag.'))).toBe(true);
  });

  it('steps into a slot underground, and carries its master again on the surface', () => {
    const { w, m } = riding();
    dismountForDungeon(w);
    expect(companionHere(w, m.id)).toMatchObject({ name: 'Bramble', remount: true });
    expect(m.companion).toBeNull();
    remountOnSurface(w);
    expect(w.npcs).toEqual([]);
    expect(riddenBy(w, m)).toMatchObject({ name: 'Bramble' });
    expect(riddenBy(w, m)?.remount).toBeUndefined();
    expect(w.log.at(-1)).toContain('Snag rides Bramble again.');
  });

  it('waits at the entrance with no room below, and is ridden again after', () => {
    const { w, m } = riding();
    for (let i = 0; i < MAX_NPCS; i++)
      addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, true);
    dismountForDungeon(w);
    expect(m.companion).toMatchObject({ remount: true });
    expect(m.companion?.ridden).toBeUndefined();
    expect(w.log.at(-1)).toContain('waits at the entrance');
    remountOnSurface(w);
    expect(riddenBy(w, m)).toMatchObject({ name: 'Bramble' });
  });

  it('stays afoot on the surface when it or its master fell below', () => {
    const { w, m } = riding();
    dismountForDungeon(w);
    (companionHere(w, m.id) as Npc).hp = 0;
    remountOnSurface(w);
    expect(companionHere(w, m.id)?.remount).toBeUndefined();
    expect(m.companion).toBeNull();
  });

  it('forgets the ride once sent away below', () => {
    const { w, m } = riding();
    dismountForDungeon(w);
    sendAway(w, m.id);
    remountOnSurface(w);
    expect(m.companion?.ridden).toBeUndefined();
  });
});
