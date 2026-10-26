import { describe, expect, it } from 'vitest';
import { hitModifier } from '../../../src/game/combat/targeting.ts';
import type { Combatant } from '../../../src/game/combat/types.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import {
  ailPenalty,
  diseaseActive,
  findDisease,
  poisonProof,
} from '../../../src/game/world/ailing.ts';
import {
  ailmentsBack,
  cure,
  exposureHere,
  infect,
  nightForAilments,
  poisonMember,
} from '../../../src/game/world/ailments.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { healNight, memberCheck, memberSheet } from '../../../src/game/world/members.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';
import { battleFrom, partySetup } from '../../../src/game/world/battle-setup.ts';

/** Only Snag left in the party, so each night's rolls are his alone. */
function alone(faces: number[] = []): { w: World; snag: Member } {
  const w = world();
  const snag = member(w, 'Snag');
  w.members = [snag];
  w.rng = scriptedRng(faces);
  return { w, snag };
}

const strain = (m: Member) => m.character.strain.value;
const poisoner = (m: Member, level: 1 | 2) => {
  m.character = { ...m.character, foci: [...m.character.foci, { id: 'poisoner', level }] };
};

describe('the Poisoned condition', () => {
  it('takes the penalty off skill checks', () => {
    const { w, snag } = alone([3, 4]);
    expect(ailPenalty(data, snag)).toBe(0);
    snag.poisoned = true;
    expect(ailPenalty(data, snag)).toBe(1);
    const before = alone([3, 4]);
    const clean = memberCheck(before.w, data, before.snag, 'notice', ['wis'], 8);
    const sick = memberCheck(w, data, snag, 'notice', ['wis'], 8);
    expect(sick.score).toBe(clean.score - 1);
  });

  it('keeps natural healing away', () => {
    const { snag } = alone();
    snag.character = { ...snag.character, hp: { ...snag.character.hp, current: 1 } };
    snag.poisoned = true;
    healNight(data, snag);
    expect(snag.character.hp.current).toBe(1);
    snag.poisoned = false;
    healNight(data, snag);
    expect(snag.character.hp.current).toBeGreaterThan(1);
  });

  it('takes hold, with strain only from a venom that has a save penalty', () => {
    const { w, snag } = alone();
    poisonMember(w, data, snag);
    expect([snag.poisoned, strain(snag)]).toEqual([true, 0]);
    poisonMember(w, data, snag, 2);
    expect(strain(snag)).toBe(1);
  });

  it('never takes the Unaging or a level-2 Poisoner', () => {
    const { w, snag } = alone();
    poisoner(snag, 1);
    expect(poisonProof(snag)).toBe(false);
    snag.character = { ...snag.character, foci: [{ id: 'poisoner', level: 2 }] };
    expect(poisonProof(snag)).toBe(true);
    poisonMember(w, data, snag, 2);
    expect([snag.poisoned, strain(snag)]).toEqual([false, 0]);
    const other = alone();
    other.snag.character = { ...other.snag.character, arts: ['unaging'] };
    expect(poisonProof(other.snag)).toBe(true);
  });

  it('is shaken off by a Physical save at night’s end, or stays', () => {
    const fail = alone([1]);
    fail.snag.poisoned = true;
    nightForAilments(fail.w, data);
    expect(fail.snag.poisoned).toBe(true);
    const pass = alone([20]);
    pass.snag.poisoned = true;
    nightForAilments(pass.w, data);
    expect(pass.snag.poisoned).toBe(false);
    expect(pass.w.log.at(-1)).toMatch(/sweats out the poison/);
  });

  it('is harder to shake off while Broken: the save loses a d6', () => {
    const { w, snag } = alone();
    const target = memberSheet(data, snag).saves.physical;
    snag.poisoned = true;
    snag.character = { ...snag.character, strain: { ...snag.character.strain, broken: true } };
    w.rng = scriptedRng([target, 1]);
    nightForAilments(w, data);
    expect(snag.poisoned).toBe(true);
  });

  it('gets its night save from the day’s end, and the revived sleep through it', () => {
    const { w, snag } = alone([20]);
    snag.poisoned = true;
    snag.slept = true;
    endOfDay(w, data);
    expect(snag.poisoned).toBe(false);
    const revived = alone([]);
    Object.assign(revived.snag, { poisoned: true, reviving: true });
    nightForAilments(revived.w, data);
    expect(revived.snag.poisoned).toBe(true);
  });
});

describe('disease', () => {
  it('is caught once, and a second never replaces the first', () => {
    const { w, snag } = alone();
    infect(w, data, snag, 'grave-rot');
    infect(w, data, snag, 'pit-flux');
    expect(snag.disease).toEqual({ id: 'grave-rot', nights: 0, saves: 0 });
    expect(w.log.at(-1)).toMatch(/Snag has caught Grave Rot\./);
    expect(() => findDisease(data, 'plague')).toThrow('unknown disease plague');
  });

  it('waits out its onset without a roll, then harms on a failed save', () => {
    // Grave Rot: one night's onset, then 1 strain a failed night.
    const { w, snag } = alone([1]);
    infect(w, data, snag, 'grave-rot');
    expect(diseaseActive(data, snag)).toBe(false);
    nightForAilments(w, data);
    expect(snag.disease).toMatchObject({ nights: 1, saves: 0 });
    expect(diseaseActive(data, snag)).toBe(true);
    nightForAilments(w, data);
    expect(strain(snag)).toBe(1);
    expect(snag.disease).toMatchObject({ nights: 2, saves: 0 });
  });

  it('ends after enough successful night saves', () => {
    const { w, snag } = alone([20, 20]);
    snag.disease = { id: 'grave-rot', nights: 1, saves: 0 };
    nightForAilments(w, data);
    expect(snag.disease).toMatchObject({ saves: 1 });
    nightForAilments(w, data);
    expect(snag.disease).toBeNull();
    expect(w.log.at(-1)).toMatch(/recovers from Grave Rot/);
  });

  it('takes hit points but leaves at least 1, or brings the penalty', () => {
    const flux = alone([1, 6]);
    flux.snag.disease = { id: 'pit-flux', nights: 1, saves: 0 };
    flux.snag.character = { ...flux.snag.character, hp: { ...flux.snag.character.hp, current: 3 } };
    nightForAilments(flux.w, data);
    expect(flux.snag.character.hp.current).toBe(1);
    const fever = alone([1, 1]);
    fever.snag.disease = { id: 'swamp-fever', nights: 0, saves: 0 };
    expect(ailPenalty(data, fever.snag)).toBe(0);
    fever.snag.disease.nights = 2;
    expect(ailPenalty(data, fever.snag)).toBe(1);
    fever.snag.poisoned = true;
    expect(ailPenalty(data, fever.snag)).toBe(2);
    nightForAilments(fever.w, data);
    expect(strain(fever.snag)).toBe(0);
  });

  it('is never a penalty when the disease harms in other ways', () => {
    const { snag } = alone();
    snag.disease = { id: 'grave-rot', nights: 5, saves: 0 };
    expect(ailPenalty(data, snag)).toBe(0);
  });
});

describe('places that sicken', () => {
  it('are swamps and the filthiest dungeon levels, never towns', () => {
    const { w } = alone();
    expect(exposureHere(w, data)).toBeNull();
    const swamp = data.content.regions
      .flatMap((r) => r.terrain.flatMap((row, y) => [...row].map((g, x) => ({ r, g, x, y }))))
      .find(({ g }) => data.content.terrains.find((t) => t.glyph === g)?.id === 'swamp');
    if (!swamp) throw new Error('no swamp on any map');
    w.region = swamp.r.id;
    w.position = { col: swamp.x, row: swamp.y };
    expect(exposureHere(w, data)).toEqual({ disease: 'swamp-fever', chance: 1 });
  });

  it('pass their disease on a roll in 6 and a failed save', () => {
    const { w, snag } = alone([1, 1]);
    const at = { disease: 'swamp-fever', chance: 1 };
    const sick = {
      ...data,
      content: {
        ...data.content,
        terrains: data.content.terrains.map((t) => ({ ...t, exposure: at })),
      },
    };
    w.position = { col: 0, row: 0 };
    nightForAilments(w, sick);
    expect(snag.disease?.id).toBe('swamp-fever');
    // A made save keeps them well.
    const hardy = alone([1, 20]);
    hardy.w.position = { col: 0, row: 0 };
    nightForAilments(hardy.w, sick);
    expect(hardy.snag.disease).toBeNull();
    // A 2 misses a 1-in-6 chance, so no one saves.
    const safe = alone([2]);
    safe.w.position = { col: 0, row: 0 };
    nightForAilments(safe.w, sick);
    expect(safe.snag.disease).toBeNull();
    // A coach's waystation shelters like a town: no roll at all.
    const stop = alone([]);
    stop.w.position = { col: 0, row: 0 };
    nightForAilments(stop.w, sick, true);
    expect(stop.snag.disease).toBeNull();
  });
});

describe('ailments out of a fight', () => {
  const after = (c: Partial<Combatant>) =>
    ({ poisoned: false, venom: 0, drained: 0, caught: null, ...c }) as Combatant;

  it('brings the poison, the venom’s strain, and a disease caught', () => {
    const { w, snag } = alone();
    ailmentsBack(w, data, snag, after({ poisoned: true, venom: 1, caught: 'grave-rot' }));
    expect([snag.poisoned, strain(snag), snag.disease?.id]).toEqual([true, 1, 'grave-rot']);
  });

  it('owes a drain its strain at the end of the fight', () => {
    const { w, snag } = alone();
    ailmentsBack(w, data, snag, after({ drained: 2 }));
    expect(strain(snag)).toBe(2);
  });

  it('brings nothing to the dead, and no poison to the immune', () => {
    const { w, snag } = alone();
    snag.dead = true;
    ailmentsBack(w, data, snag, after({ poisoned: true, caught: 'grave-rot' }));
    expect([snag.poisoned, snag.disease]).toEqual([false, null]);
    const proof = alone();
    proof.snag.character = { ...proof.snag.character, arts: ['unaging'] };
    ailmentsBack(proof.w, data, proof.snag, after({ poisoned: true }));
    expect(proof.snag.poisoned).toBe(false);
  });

  it('are ended by a cure', () => {
    const { snag } = alone();
    Object.assign(snag, { poisoned: true, disease: { id: 'pit-flux', nights: 0, saves: 0 } });
    cure(snag, 'poison');
    expect(snag.poisoned).toBe(false);
    cure(snag, 'disease');
    expect(snag.disease).toBeNull();
  });

  it('can push strain past the maximum like other poisons', () => {
    const { w, snag } = alone();
    const max = characterSheet(snag.character, data).strainMax;
    snag.character = { ...snag.character, strain: { value: max, broken: true } };
    ailmentsBack(w, data, snag, after({ venom: 1 }));
    expect(strain(snag)).toBe(max + 1);
  });
});

describe('ailments in a fight', () => {
  it('bring the Poisoned and their penalty in, and take it off hit rolls', () => {
    const w = world();
    const snag = member(w, 'Snag');
    snag.poisoned = true;
    snag.disease = { id: 'swamp-fever', nights: 2, saves: 0 };
    const setup = partySetup(w, data, [['thug-or-militia']], false);
    const b = battleFrom(data, createRng('ail'), setup, false);
    const c = b.combatants[w.members.indexOf(snag)] as Combatant;
    const grukk = b.combatants[w.members.indexOf(member(w, 'Grukk'))] as Combatant;
    expect([c.poisoned, c.ailPenalty, grukk.ailPenalty]).toEqual([true, 2, 0]);
    expect(hitModifier(b, c)).toBe(hitModifier(b, grukk) - 2);
  });
});
