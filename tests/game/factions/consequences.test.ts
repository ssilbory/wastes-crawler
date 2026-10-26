import { describe, expect, it } from 'vitest';
import { nearbyPatrols, patrolBeaten, rollPatrol } from '../../../src/game/factions/patrols.ts';
import { sack, strikesFor } from '../../../src/game/factions/strikes.ts';
import { pickGoal } from '../../../src/game/factions/goals.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { maybeEncounter } from '../../../src/game/world/encounters.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, faction, factionWorld, held } from './helpers.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';

/** The party on the Dark Lands plains two hexes from Lanternfall. */
function nearLanternfall() {
  const w = factionWorld();
  enterRegion(w, 'dark-lands', { col: 12, row: 4 });
  return w;
}

describe('strikes beyond the two factions (Phase 13b)', () => {
  it('sacks a settlement when the blow lands on the faction holding it', () => {
    const w = factionWorld();
    pickGoal(w, data, 'bastion', 1);
    const onStrike = strikesFor(w, data, 'bastion');
    onStrike('settlements', 'gutterwick', { hit: true, dealt: 2, razed: false });
    expect(w.raided).toEqual({ gutterwick: 31 });
    expect(w.log.at(-1)).toContain('Gutterwick is sacked. Prices there are up for a month.');
    expect(faction(w, 'bastion').goal?.progress).toBe(2);
    // A miss, or a fight between two others in the town, sacks nothing.
    onStrike('settlements', 'cinderhold', { hit: false, dealt: 0, razed: false });
    onStrike('warhost', 'cinderhold', { hit: true, dealt: 3, razed: false });
    expect(Object.keys(w.raided)).toEqual(['gutterwick']);
    // A base razed sacks the town even though the base is gone.
    faction(w, 'settlements').bases = faction(w, 'settlements').bases.filter(
      (b) => b.at !== 'mirewatch',
    );
    onStrike('settlements', 'mirewatch', { hit: true, dealt: 2, razed: true });
    expect(Object.keys(w.raided)).toEqual(['gutterwick', 'mirewatch']);
    // Only the clock faction moves the clock.
    expect(w.clock).toBe(0);
  });

  it('never sacks a place that is no settlement', () => {
    const w = factionWorld();
    sack(w, data, 'dawnwall');
    expect(w.raided).toEqual({});
  });
});

describe('faction patrols (Phase 13b)', () => {
  it('come from hostile assets within three hexes, in the same region', () => {
    const w = nearLanternfall();
    expect(nearbyPatrols(w, data)).toEqual([]);
    held(w, 'warhost', 'infantry').at = 'lanternfall';
    held(w, 'warhost', 'manufactory').at = 'lanternfall';
    held(w, 'bastion', 'infantry').at = 'cinderhold';
    // The settlements send no patrols.
    expect(nearbyPatrols(w, data)).toEqual([
      {
        rows: [['beastman-trooper', 'beastman-trooper', 'beastman-trooper'], ['predator-beastman']],
        key: 'warhost:a1',
        name: "Grisk's Warhost's Beastman Warband",
      },
    ]);
    faction(w, 'warhost').hp = 0;
    expect(nearbyPatrols(w, data)).toEqual([]);
    const b = factionWorld();
    held(b, 'warhost', 'infantry').at = 'lanternfall';
    enterRegion(b, 'borderlands', { col: 12, row: 4 });
    expect(nearbyPatrols(b, data)).toEqual([]);
  });

  it('stand in for a wandering encounter one time in two', () => {
    const w = nearLanternfall();
    held(w, 'warhost', 'infantry').at = 'lanternfall';
    held(w, 'warhost', 'scouts').at = 'lanternfall';
    w.rng = scriptedRng([2]);
    expect(rollPatrol(w, data)).toBeNull();
    w.rng = scriptedRng([1, 2]);
    expect(rollPatrol(w, data)?.key).toBe('warhost:a2');
    const far = factionWorld();
    expect(rollPatrol(far, data)).toBeNull();
  });

  it('meet the party on the road, and pay for losing', () => {
    const w = nearLanternfall();
    held(w, 'warhost', 'scouts').at = 'lanternfall';
    // The encounter die hits (1 on a d16), the patrol comes (1 on a d2), then the reaction roll.
    w.rng = scriptedRng([1, 1, 1, 6, 6, 1, 1, 1, 1]);
    expect(maybeEncounter(w, data, undefined, false)).toBe(true);
    expect(w.encounter).toMatchObject({
      enemies: [['predator-beastman', 'predator-beastman']],
      patrol: 'warhost:a2',
    });
    expect(w.log.at(-1)).toContain("They march for Grisk's Warhost's Predator Pack.");
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null, patrol: 'warhost:a2' });
    // Half of the pack's 5 hit points, rounded up.
    expect(held(w, 'warhost', 'scouts').hp).toBe(2);
    expect(w.log.join('\n')).toContain("The defeat costs Grisk's Warhost's Predator Pack dearly.");
    patrolBeaten(w, data, 'warhost:a99');
    patrolBeaten(w, data, 'pirates:a1');
    emit(w, data, { kind: 'fight-won', quest: null, garrison: null, patrol: 'warhost:a2' });
    expect(faction(w, 'warhost').assets.some((a) => a.uid === 'a2')).toBe(false);
  });
});

describe("the clock faction's losses (Phase 13b)", () => {
  it('hurt its sturdiest asset when a quest or rescue knocks the clock back', () => {
    const w = factionWorld();
    emit(w, data, { kind: 'quest-done', quest: 'cull-records' });
    expect(held(w, 'warhost', 'scouts').hp).toBe(5);
    expect(faction(w, 'warhost').assets.some((a) => a.asset === 'infantry')).toBe(false);
    expect(w.log.join('\n')).toContain("Grisk's Warhost's Beastman Warband feels the blow.");
    // Then the pack, the sturdiest left, is lost to the freed crafter.
    emit(w, data, { kind: 'captive-freed', captive: 'held-crafter' });
    expect(faction(w, 'warhost').assets.map((a) => a.asset)).toEqual([
      'armed-guards',
      'manufactory',
    ]);
    // Other quests and captives leave it alone.
    emit(w, data, { kind: 'quest-done', quest: 'raider-camp' });
    emit(w, data, { kind: 'captive-freed', captive: 'nobody' });
    expect(held(w, 'warhost', 'manufactory').hp).toBe(4);
    // The breeding pens outlast the slaver guards.
    emit(w, data, { kind: 'quest-done', quest: 'mire-slavers' });
    expect(faction(w, 'warhost').assets.map((a) => a.asset)).toEqual(['armed-guards']);
    faction(w, 'warhost').assets = [];
    emit(w, data, { kind: 'quest-done', quest: 'cull-records' });
    faction(w, 'warhost').hp = 0;
    emit(w, data, { kind: 'quest-done', quest: 'cull-records' });
    expect(faction(w, 'warhost').assets).toEqual([]);
  });
});
