import { describe, expect, it } from 'vitest';
import { addAsset } from '../../../src/game/factions/state.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { progressOf } from '../../../src/game/world/major-projects.ts';
import { nearbyHex } from '../../../src/game/world/sieges.ts';
import { stayAtInn } from '../../../src/game/world/services.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member } from './helpers.ts';
import {
  asset,
  bare,
  besieged,
  fightOf,
  firstRoll,
  HILLS,
  LANTERNFALL,
  undefended,
  warbandOnly,
  won,
} from './siege-helpers.ts';

describe('a siege’s assaults with the party there (docs/rules-adaptation.md, Sieges)', () => {
  it('waits for its day, then assaults every day, the party away', () => {
    const { w, s } = besieged(HILLS);
    emit(w, data, { kind: 'day-passed' });
    expect(s.next).toBe(7);
    w.day = 7;
    emit(w, data, { kind: 'day-passed' });
    expect(w.log.join('\n')).toContain("Grisk's Warhost storms Lanternfall");
    expect(w.encounter).toBeNull();
    // Unless it ended that night, the next comes tomorrow.
    if (w.sieges.length > 0) expect(s.next).toBe(8);
  });

  it('gives a party inside its share: the sturdiest besieger’s patrol, alone', () => {
    const { w, s } = besieged();
    warbandOnly(w);
    s.next = w.day;
    emit(w, data, { kind: 'day-passed' });
    expect(s.joined).toBe(true);
    expect(w.encounter?.siege).toEqual(fightOf(s, 'a1', 'assault'));
    expect(w.encounter?.enemies).toEqual([
      ['beastman-trooper', 'beastman-trooper', 'beastman-trooper'],
      ['predator-beastman'],
    ]);
    expect(s.gate).toMatchObject({ uid: 'a1', size: 4 });
    expect(w.log.at(-1)).toContain("Grisk's Warhost's Beastman Warband storms the gates!");
    // Beating them costs the warband a hit point a fighter.
    emit(w, data, won(fightOf(s, 'a1', 'assault')));
    expect(asset(w, 'a1')?.hp).toBe(2);
    // A share whose night has been cleared away costs nothing more.
    s.gate = null;
    emit(w, data, won(fightOf(s, 'a1', 'assault')));
    expect(asset(w, 'a1')?.hp).toBe(2);
  });

  it('gives the party the sturdiest besieger, wherever it stands in the line', () => {
    const { w, s } = besieged();
    // The warband is worn to 2, so the 5-hp scouts are the sturdiest; a garrison holds the rest.
    const band = asset(w, 'a1');
    if (band) band.hp = 2;
    const free = w.factions.settlements;
    if (free) for (let i = 0; i < 3; i++) addAsset(data, free, 'infantry', 'lanternfall');
    s.next = w.day;
    emit(w, data, { kind: 'day-passed' });
    expect(s.gate?.uid).toBe('a2');
    expect(w.encounter?.siege).toEqual(fightOf(s, 'a2', 'assault'));
  });

  it('halves the party’s share behind walls', () => {
    const { w, s } = besieged();
    w.majorProjects['wall-lanternfall'] = { ...progressOf(w, 'wall-lanternfall'), done: 0 };
    warbandOnly(w);
    // The walls don't turn this one back.
    w.rng = firstRoll(99);
    s.next = w.day;
    emit(w, data, { kind: 'day-passed' });
    expect(w.encounter?.enemies).toEqual([['beastman-trooper', 'beastman-trooper']]);
    expect(s.gate?.size).toBe(2);
  });

  it('is turned back by the walls on their roll, with nothing for the party to fight', () => {
    const { w, s } = besieged();
    w.majorProjects['wall-lanternfall'] = { ...progressOf(w, 'wall-lanternfall'), done: 0 };
    w.rng = scriptedRng([1]);
    s.next = w.day;
    emit(w, data, { kind: 'day-passed' });
    expect(w.encounter).toBeNull();
    expect(s.gate).toBeNull();
  });

  it('drives a party caught in a lost assault out, 3 System Strain each', () => {
    const { w, s } = besieged();
    s.gate = { uid: 'a1', size: 4, lost: true };
    w.encounter = encounter([['beastman-trooper']]);
    emit(w, data, { kind: 'fight-over', won: true, siege: fightOf(s, 'a1', 'assault') });
    expect(s.gate).toBeNull();
    expect(w.position).toEqual(nearbyHex(w, data, s));
    expect(w.position).not.toEqual(LANTERNFALL);
    expect(member(w, 'Snag').character.strain.value).toBe(3);
    expect(w.log.at(-1)).toContain("Lanternfall's defenders are overrun");
  });

  it('leaves a party in a held town where it stands', () => {
    const { w, s } = besieged();
    s.gate = { uid: 'a1', size: 4, lost: false };
    emit(w, data, { kind: 'fight-over', won: false, siege: fightOf(s, 'a1', 'assault') });
    expect(w.position).toEqual(LANTERNFALL);
    // A siege gone by then, or a fight that was none of its, changes nothing.
    w.sieges = [];
    emit(w, data, { kind: 'fight-over', won: false, siege: fightOf(s, 'a1', 'enter') });
    emit(w, data, { kind: 'fight-over', won: false, siege: null });
    expect(w.position).toEqual(LANTERNFALL);
  });

  it('drives the party out at once when it is busy with another fight and the town falls', () => {
    const { w, s } = besieged();
    undefended(w);
    w.encounter = encounter([['beastman-trooper']]);
    s.next = w.day;
    emit(w, bare, { kind: 'day-passed' });
    expect(w.position).not.toEqual(LANTERNFALL);
    expect(member(w, 'Grukk').character.strain.value).toBe(3);
  });

  it('drives a party sleeping at the inn out, unrested, when the town falls that night', () => {
    const { w, s } = besieged();
    undefended(w);
    s.next = w.day;
    const day = w.day;
    member(w, 'Snag').character.strain.value = 1;
    expect(stayAtInn(w, bare)).toEqual({ ok: true });
    expect(w.day).toBe(day + 1);
    expect(w.position).not.toEqual(LANTERNFALL);
    // Driven out by the lost assault: 3 strain on top, and no night's rest to clear it.
    expect(member(w, 'Snag').character.strain.value).toBe(4);
    expect(w.log.join('\n')).not.toContain('stays the night at the inn in Lanternfall');
  });

  it('gives no share once the night’s assault has ended the siege', () => {
    const { w, s } = besieged();
    undefended(w);
    const free = w.factions.settlements;
    if (free) free.bases = free.bases.filter((b) => b.at !== 'lanternfall');
    s.next = w.day;
    // The settle before the assault finds the town already fallen.
    emit(w, bare, { kind: 'day-passed' });
    expect(w.sieges).toEqual([]);
    expect(w.encounter).toBeNull();
  });

  it('clears a share left over from a fight that never finished', () => {
    const { w, s } = besieged(HILLS);
    s.gate = { uid: 'a1', size: 4, lost: true };
    emit(w, data, { kind: 'day-passed' });
    expect(s.gate).toBeNull();
  });
});
