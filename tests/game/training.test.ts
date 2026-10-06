import { describe, expect, it } from 'vitest';
import type { Character } from '../../src/data/schemas/index.ts';
import {
  boostAttribute,
  boostsTaken,
  changeClass,
  creditSkill,
  prepareSpells,
  raiseSkill,
  type TrainResult,
} from '../../src/game/character/training.ts';
import { finalScores } from '../../src/game/character/derived.ts';
import { levelUpMember, trainMember } from '../../src/game/world/training.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';
import { data, starter } from './combat/helpers.ts';
import { member, world } from './world/helpers.ts';

const points = (c: Character, skillPoints: number, quickPoints = 0, level = 1): Character => ({
  ...c,
  advancement: { ...c.advancement, skillPoints, quickPoints },
  classes: { current: c.classes.current, levels: { [c.classes.current]: level } },
});
const ok = (r: TrainResult) => {
  if (!r.ok) throw new Error(r.reason);
  return r.character;
};

describe('raising skills (SRD 2.7.1.4)', () => {
  it('buys the next level in order, within the character level', () => {
    const snag = points(starter('snag'), 6);
    expect(raiseSkill(data, snag, 'juggle')).toEqual({ ok: false, reason: 'unknown skill juggle' });
    const lead = ok(raiseSkill(data, snag, 'lead'));
    expect(lead.skills.lead).toBe(0);
    expect(lead.advancement.skillPoints).toBe(5);
    expect(ok(raiseSkill(data, lead, 'lead')).skills.lead).toBe(1);
    expect(raiseSkill(data, snag, 'stab')).toEqual({
      ok: false,
      reason: 'stab needs a higher character level',
    });
    const master = { ...snag, skills: { ...snag.skills, stab: 4 } };
    expect(raiseSkill(data, master, 'stab')).toEqual({
      ok: false,
      reason: 'stab is at its maximum',
    });
    expect(raiseSkill(data, points(snag, 0), 'lead')).toEqual({
      ok: false,
      reason: 'that costs 1 skill points',
    });
  });

  it('spends credit first, then Quick Learner points on non-combat skills only', () => {
    const lirael = points(starter('lirael'), 1, 1, 3);
    const credited = {
      ...lirael,
      advancement: { ...lirael.advancement, skillCredit: { notice: 2 } },
    };
    const notice = ok(raiseSkill(data, credited, 'notice'));
    expect(notice.skills.notice).toBe(2);
    expect(notice.advancement).toEqual({ skillPoints: 1, quickPoints: 0, skillCredit: {} });
    const sneak = ok(raiseSkill(data, lirael, 'sneak'));
    expect(sneak.advancement).toMatchObject({ skillPoints: 0, quickPoints: 0 });
    expect(raiseSkill(data, lirael, 'shoot')).toEqual({
      ok: false,
      reason: 'that costs 3 skill points',
    });
    expect(ok(raiseSkill(data, points(lirael, 1, 1), 'punch')).advancement).toMatchObject({
      skillPoints: 0,
      quickPoints: 1,
    });
  });
});

describe('a focus’s bonus skill as points (SRD 2.7.1.6)', () => {
  it('keeps what doesn’t buy a level as credit', () => {
    const c = creditSkill(starter('snag'), 'stab', 2);
    expect(c.skills.stab).toBe(1);
    expect(c.advancement.skillCredit).toEqual({ stab: 2 });
    const more = creditSkill(c, 'stab', 3);
    expect(more.skills.stab).toBe(2);
    expect(more.advancement.skillCredit).toEqual({ stab: 2 });
    const top = creditSkill({ ...more, skills: { ...more.skills, stab: 3 } }, 'stab', 4);
    // What reaching level-4 leaves over becomes ordinary skill points, never stranded credit.
    expect(top.skills.stab).toBe(4);
    expect(top.advancement.skillCredit).toEqual({});
    expect(top.advancement.skillPoints).toBe(more.advancement.skillPoints + 1);
    expect(creditSkill(starter('snag'), 'ride', 3).skills.ride).toBe(1);
  });

  it('turns points for a level-4 skill into ordinary skill points', () => {
    const snag = { ...starter('snag'), skills: { stab: 4 } };
    expect(creditSkill(snag, 'stab', 3).advancement.skillPoints).toBe(3);
    expect(creditSkill(snag, 'ride', 0).skills).toEqual({ stab: 4 });
  });
});

describe('attribute boosts (SRD 2.7.1.5)', () => {
  it('costs the boost’s number in points, Quick Learner points included', () => {
    const lirael = points(starter('lirael'), 2, 1, 3);
    const first = ok(boostAttribute(data, lirael, 'dex'));
    expect(first.attributes.advancement).toEqual({ dex: 1 });
    expect(finalScores(first).dex).toBe(finalScores(lirael).dex + 1);
    expect(first.advancement).toMatchObject({ skillPoints: 2, quickPoints: 0 });
    const second = ok(boostAttribute(data, first, 'dex'));
    expect(boostsTaken(second)).toBe(2);
    expect(second.advancement.skillPoints).toBe(0);
    expect(boostAttribute(data, second, 'con')).toEqual({
      ok: false,
      reason: 'that costs 3 skill points',
    });
  });

  it('needs levels 3, 6, and 9 for later boosts, five at most, 18 at most', () => {
    const snag = points(starter('snag'), 20);
    const twice = { ...snag, attributes: { ...snag.attributes, advancement: { con: 2 } } };
    expect(boostAttribute(data, twice, 'con')).toEqual({
      ok: false,
      reason: 'the next boost needs a higher character level',
    });
    const five = { ...snag, attributes: { ...snag.attributes, advancement: { con: 2, wis: 3 } } };
    expect(boostAttribute(data, five, 'con')).toEqual({
      ok: false,
      reason: 'five boosts is the most anyone can buy',
    });
    const strong = {
      ...snag,
      attributes: { ...snag.attributes, advancement: { dex: 18 - finalScores(snag).dex } },
    };
    expect(boostAttribute(data, strong, 'dex')).toEqual({ ok: false, reason: 'dex is already 18' });
  });
});

describe('preparing spells and switching class', () => {
  it('prepares known spells up to the limit', () => {
    const fizz = starter('fizzwick');
    const known = fizz.spells.known;
    expect(prepareSpells(data, starter('snag'), [])).toEqual({
      ok: false,
      reason: 'Snag casts no spells',
    });
    expect(prepareSpells(data, fizz, ['fireball'])).toEqual({
      ok: false,
      reason: 'prepare only known spells',
    });
    expect(prepareSpells(data, fizz, [known[0] as string, known[0] as string])).toEqual({
      ok: false,
      reason: 'prepare each spell once',
    });
    expect(prepareSpells(data, fizz, known)).toEqual({
      ok: false,
      reason: 'Fizzwick can prepare 3 spells',
    });
    expect(ok(prepareSpells(data, fizz, known.slice(1))).spells.prepared).toEqual(known.slice(1));
  });

  it('switches only after 4th level in the current class', () => {
    const snag = starter('snag');
    expect(changeClass(data, snag, 'full-expert')).toEqual({
      ok: false,
      reason: 'switching needs 4th level in the current class',
    });
    expect(changeClass(data, snag, 'full-warrior')).toEqual({
      ok: false,
      reason: 'Snag is already in that class',
    });
    expect(changeClass(data, snag, 'partial-expert-partial-mage')).toEqual({
      ok: false,
      reason: "partial-expert-partial-mage isn't a class in this version",
    });
    const veteran = points(snag, 0, 0, 4);
    expect(ok(changeClass(data, veteran, 'full-expert')).classes).toEqual({
      current: 'full-expert',
      levels: { 'full-warrior': 4, 'full-expert': 0 },
    });
  });
});

describe('training in town', () => {
  it('levels up and trains living party members', () => {
    const w = world();
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, xp: 3 };
    w.rng = scriptedRng([6, 6]);
    expect(
      levelUpMember(w, data, 'm-0', { foci: [{ id: 'die-hard' }], arts: [], spells: [] }),
    ).toEqual({
      ok: true,
    });
    expect(w.log.at(-1)).toBe('Day 1, morning: Snag reaches level 2 (20 HP).');
    expect(levelUpMember(w, data, 'm-0', { foci: [], arts: [], spells: [] })).toEqual({
      ok: false,
      reason: 'Snag needs 6 XP',
    });
    expect(trainMember(w, data, 'm-0', (c) => raiseSkill(data, c, 'lead'))).toEqual({ ok: true });
    expect(snag.character.skills.lead).toBe(0);
    expect(trainMember(w, data, 'm-0', (c) => raiseSkill(data, c, 'juggle'))).toMatchObject({
      ok: false,
    });
    snag.dead = true;
    expect(() => trainMember(w, data, 'm-0', (c) => raiseSkill(data, c, 'lead'))).toThrow(
      'no living party member m-0',
    );
  });
});
