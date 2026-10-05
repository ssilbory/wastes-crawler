import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import { applyPeopleModifiers, checkAttributeBonus } from '../../src/game/character/attributes.ts';
import type { GameData } from '../../src/game/character/context.ts';
import { progressionLookup } from '../../src/game/character/context.ts';
import {
  emptyChoices,
  evaluateChoices,
  finishCharacter,
  rollBackground,
  type Choices,
} from '../../src/game/character/creation.ts';
import { addCreationSkill } from '../../src/game/character/skills.ts';
import type { AttributeScores } from '../../src/rules/attributes.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const data: GameData = { srd: loadSrd(), content: loadContent() };
const array: AttributeScores = { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 };

/** A complete Goblin Raider Warrior. */
const raider = (): Choices => ({
  ...emptyChoices(),
  people: 'goblin',
  array,
  background: { id: 'raider', choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] } },
  classId: 'full-warrior',
  foci: [null, null, { id: 'alert' }, { id: 'armsmaster' }, { id: 'lucky' }],
  gear: { mode: 'package', packageId: 'shield-wall' },
  freeSkill: 'notice',
  name: 'Snag',
  goal: 'Outlive the war-band',
});

describe('evaluateChoices', () => {
  it('evaluates a complete Goblin Warrior', () => {
    const ev = evaluateChoices(raider(), data);
    expect(ev.complete).toBe(true);
    expect(ev.scores).toEqual({ str: 12, dex: 14, con: 11, int: 11, wis: 9, cha: 7 });
    expect(ev.peopleAdjust).toEqual({ str: -2, dex: 2, int: 1 });
    // Warren-born raises Sneak, Armsmaster raises Stab, Alert and the free pick give Notice-1.
    expect(ev.skills).toEqual({ stab: 1, sneak: 1, exert: 0, survive: 0, notice: 1 });
  });

  it('starts with every step incomplete', () => {
    const ev = evaluateChoices(emptyChoices(), data);
    expect(ev.complete).toBe(false);
    expect(Object.values(ev.steps).every((s) => s.state === 'incomplete')).toBe(true);
    expect(ev.scores).toBeNull();
  });

  it('rejects scores that are not the standard array, and unknown peoples', () => {
    const notArray = evaluateChoices({ ...raider(), array: { ...array, str: 18 } }, data);
    expect(notArray.steps.attributes).toMatchObject({ state: 'error' });
    expect(notArray.steps.background).toEqual({ state: 'incomplete' });
    const dwarf = evaluateChoices({ ...raider(), people: 'dwarf' }, data);
    expect(dwarf.steps.people).toMatchObject({ state: 'error', message: 'unknown people dwarf' });
    expect(dwarf.steps.attributes).toEqual({ state: 'ok' });
    expect(dwarf.scores).toBeNull();
  });

  it('leaves the background incomplete until one is chosen', () => {
    expect(evaluateChoices({ ...raider(), background: null }, data).steps.background).toEqual({
      state: 'incomplete',
    });
  });

  it('rejects unknown backgrounds, bad indexes, and too many picks', () => {
    const bg = (background: Choices['background']) =>
      evaluateChoices({ ...raider(), background }, data).steps.background;
    expect(bg({ id: 'pirate', choice: { mode: 'pick', picks: [] } })).toMatchObject({
      state: 'error',
    });
    expect(bg({ id: 'raider', choice: { mode: 'pick', picks: [{ index: 9 }] } })).toMatchObject({
      message: 'no such background table entry',
    });
    const three = [{ index: 1 }, { index: 2 }, { index: 3 }];
    expect(bg({ id: 'raider', choice: { mode: 'pick', picks: three } })).toMatchObject({
      message: 'expected 2 entries',
    });
    expect(bg({ id: 'raider', choice: { mode: 'pick', picks: [{ index: 1 }] } })).toEqual({
      state: 'incomplete',
    });
  });

  it('resolves "Any Combat" to Stab, Shoot, or Punch', () => {
    const pick = (skill?: string) =>
      evaluateChoices(
        {
          ...raider(),
          background: {
            id: 'raider',
            choice: {
              mode: 'pick',
              picks: [{ index: 0, ...(skill ? { skill } : {}) }, { index: 1 }],
            },
          },
        },
        data,
      );
    expect(pick().steps.background).toEqual({ state: 'incomplete' });
    expect(pick('notice').steps.background).toMatchObject({
      message: "notice isn't a combat skill",
    });
    expect(pick('stab').skills.stab).toBe(1);
  });

  it('refuses a third pick of a skill, and allows a substitute once it is level-1', () => {
    const scavenger = (picks: { index: number; skill?: string }[]) =>
      evaluateChoices(
        { ...raider(), background: { id: 'scavenger', choice: { mode: 'pick', picks } } },
        data,
      );
    expect(scavenger([{ index: 4 }, { index: 4 }]).steps.background).toMatchObject({
      message: 'survive is already level-1; choose another skill',
    });
    const substituted = scavenger([{ index: 4 }, { index: 4, skill: 'trade' }]);
    expect(substituted.steps.background).toEqual({ state: 'ok' });
    expect(substituted.skills).toMatchObject({ survive: 1, trade: 0 });
    expect(scavenger([{ index: 0, skill: 'trade' }, { index: 1 }]).steps.background).toMatchObject({
      message: 'trade can only replace notice once it is level-1',
    });
    expect(scavenger([{ index: 4 }, { index: 4, skill: 'juggle' }]).steps.background).toMatchObject(
      {
        message: 'unknown skill juggle',
      },
    );
  });

  it('applies rolled Growth entries, including split attribute bonuses and "Any Skill"', () => {
    const rolls = rollBackground(scriptedRng([2, 6, 5]), ['growth', 'growth', 'learning']);
    expect(rolls).toEqual([
      { table: 'growth', index: 1 },
      { table: 'growth', index: 5 },
      { table: 'learning', index: 4 },
    ]);
    const roll = (r: typeof rolls) =>
      evaluateChoices(
        { ...raider(), background: { id: 'raider', choice: { mode: 'roll', rolls: r } } },
        data,
      );

    expect(roll(rolls).steps.background).toEqual({ state: 'incomplete' });
    const [plus2, anySkill, notice] = rolls as [
      (typeof rolls)[0],
      (typeof rolls)[0],
      (typeof rolls)[0],
    ];
    const done = roll([
      { ...plus2, allocation: { str: 1, con: 1 } },
      { ...anySkill, skill: 'heal' },
      notice,
    ]);
    expect(done.steps.background).toEqual({ state: 'ok' });
    expect(done.backgroundAdjust).toEqual({ str: 1, con: 1 });
    expect(done.scores).toMatchObject({ str: 13, con: 12 });
    expect(done.skills).toMatchObject({ heal: 0, notice: 1 });
    expect(roll([{ ...plus2, allocation: { int: 2 } }]).steps.background).toMatchObject({
      message: 'attribute bonus: wrong-pool',
    });
    expect(
      roll([
        { ...plus2, allocation: { str: 1, dex: 1 } },
        { ...plus2, allocation: { str: 1 } },
      ]).backgroundAdjust,
    ).toEqual({
      str: 1,
      dex: 1,
    });
    expect(roll([plus2, anySkill]).steps.background).toEqual({ state: 'incomplete' });
    expect(() => rollBackground(scriptedRng([]), ['growth'])).toThrow();
  });

  it('accepts only the class options', () => {
    const cls = (classId: string) => evaluateChoices({ ...raider(), classId }, data).steps.class;
    expect(cls('partial-expert-partial-warrior')).toEqual({ state: 'ok' });
    expect(cls('partial-expert-partial-mage')).toMatchObject({ state: 'error' });
    const noWarrior = {
      ...data,
      srd: {
        ...data.srd,
        progressions: data.srd.progressions.filter((p) => p.id !== 'full-warrior'),
      },
    };
    expect(evaluateChoices(raider(), noWarrior).steps.class).toMatchObject({ state: 'error' });
  });

  it('checks the free skill', () => {
    const free = (freeSkill: string) =>
      evaluateChoices({ ...raider(), freeSkill }, data).steps['free-skill'];
    expect(free('juggle')).toMatchObject({ message: 'unknown skill juggle' });
    const twice = {
      ...raider(),
      background: {
        id: 'raider',
        choice: { mode: 'pick' as const, picks: [{ index: 1 }, { index: 1 }] },
      },
    };
    expect(
      evaluateChoices({ ...twice, freeSkill: 'sneak' }, data).steps['free-skill'],
    ).toMatchObject({
      message: 'sneak is already level-1',
    });
  });

  it('checks the name and goal', () => {
    const id = (name: string, goal = '') =>
      evaluateChoices({ ...raider(), name, goal }, data).steps.identity;
    expect(id('   ')).toEqual({ state: 'incomplete' });
    expect(id('x'.repeat(61))).toMatchObject({ state: 'error' });
    expect(id('Snag', 'x'.repeat(201))).toMatchObject({ state: 'error' });
  });
});

describe('finishCharacter', () => {
  it('rolls starting HP from the class die and Con, and saves the choices', () => {
    const result = finishCharacter(raider(), data, scriptedRng([4, 0xabc, 0xdef]));
    if (!result.ok) throw new Error(result.errors.join('; '));
    expect(result.character).toMatchObject({
      schemaVersion: 7,
      id: 'char-00000abc00000def',
      name: 'Snag',
      people: 'goblin',
      background: 'raider',
      attributes: {
        base: array,
        people: { str: -2, dex: 2, int: 1 },
        background: {},
        advancement: {},
      },
      classes: { current: 'full-warrior', levels: { 'full-warrior': 1 } },
      hp: { max: 6, current: 6 },
      xp: 0,
      advancement: { skillPoints: 0, quickPoints: 0, skillCredit: {} },
      strain: { value: 0, broken: false },
    });
  });

  it('lists what is missing', () => {
    expect(
      finishCharacter({ ...raider(), name: '', classId: 'full-mage' }, data, scriptedRng([])),
    ).toEqual({
      ok: false,
      errors: [
        "class: full-mage isn't a starting class in this version",
        'foci: incomplete',
        'magic: incomplete',
        'identity: incomplete',
      ],
    });
  });
});

describe('helpers', () => {
  it('clamps people modifiers to 3–18 and records what was applied', () => {
    const r = applyPeopleModifiers({ ...array, str: 5, dex: 16 }, { str: -4, dex: 4 });
    expect(r.scores).toMatchObject({ str: 3, dex: 18 });
    expect(r.applied).toEqual({ str: -2, dex: 2 });
  });

  it('validates attribute bonus allocations', () => {
    expect(checkAttributeBonus(array, 2, 'physical', { str: 2 })).toBeNull();
    expect(checkAttributeBonus(array, 2, 'physical', { str: 1 })).toBe('wrong-total');
    expect(checkAttributeBonus(array, 1, 'any', { str: 0.5, dex: 0.5 })).toBe('wrong-total');
    expect(checkAttributeBonus(array, 2, 'mental', { str: 2 })).toBe('wrong-pool');
    expect(checkAttributeBonus({ ...array, str: 17 }, 2, 'physical', { str: 2 })).toBe('over-18');
  });

  it('adds creation skills without reading the prototype', () => {
    expect(addCreationSkill({}, 'constructor')).toEqual({ constructor: 0 });
  });

  it('throws for an unknown class in the progression lookup', () => {
    expect(() => progressionLookup(data)('nope')).toThrow();
  });
});
