import { describe, expect, it } from 'vitest';
import type { Character, ClassOption } from '../../src/data/schemas/index.ts';
import {
  advance,
  canLevelUp,
  levelPlan,
  type LevelChoices,
  type LevelPlan,
} from '../../src/game/character/advance.ts';
import { classOption } from '../../src/game/character/class-step.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { artChoices, learnableSpells } from '../../src/game/character/magic.ts';
import { xpForLevel } from '../../src/rules/advancement.ts';
import { changeClass } from '../../src/game/character/training.ts';
import { createRng } from '../../src/rules/rng.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';
import { data, starter } from './combat/helpers.ts';

const none: LevelChoices = { foci: [], arts: [], spells: [] };
const withXp = (c: Character, xp: number): Character => ({ ...c, xp });
const ok = (r: ReturnType<typeof advance>) => {
  if (!r.ok) throw new Error(r.reason);
  return r;
};
/** Snag as a 4th-level Warrior, switched to another class with XP for 5th. */
function switched(target: string): Character {
  const c = {
    ...starter('snag'),
    xp: 18,
    classes: { current: 'full-warrior', levels: { 'full-warrior': 4 } },
  };
  const r = changeClass(data, c, target);
  if (!r.ok) throw new Error(r.reason);
  return r.character;
}

describe('the next level (SRD 2.7.1)', () => {
  it('needs the XP for the next level', () => {
    const snag = starter('snag');
    expect(canLevelUp(data, snag)).toBe(false);
    expect(levelPlan(data, snag)).toBeNull();
    expect(advance(data, snag, none, scriptedRng([]))).toEqual({
      ok: false,
      reason: 'Snag needs 3 XP',
    });
    expect(canLevelUp(data, withXp(snag, 3))).toBe(true);
  });

  it('plans the class table’s focus picks, skill points, and Quick Learner', () => {
    expect(levelPlan(data, withXp(starter('snag'), 3))).toEqual({
      classId: 'full-warrior',
      classLevel: 2,
      focusPicks: ['any'],
      arts: [],
      spells: 0,
      maxSpellLevel: 0,
      skillPoints: 3,
      quickPoints: 0,
      bonusSkills: [],
    });
    expect(levelPlan(data, withXp(starter('lirael'), 3))?.quickPoints).toBe(1);
    const pem = 'partial-expert-partial-mage';
    const odd = { ...starter('snag'), xp: 3, classes: { current: pem, levels: { [pem]: 1 } } };
    expect(() => levelPlan(data, odd)).toThrow(`unknown class ${pem}`);
  });

  it('rolls hit points, adds skill points, and takes a new focus', () => {
    const snag = withXp(starter('snag'), 3);
    expect(advance(data, snag, none, scriptedRng([]))).toEqual({
      ok: false,
      reason: 'pick 1 foci',
    });
    const r = ok(advance(data, snag, { ...none, foci: [{ id: 'die-hard' }] }, scriptedRng([6, 6])));
    expect(r.character.classes.levels).toEqual({ 'full-warrior': 2 });
    expect(characterSheet(r.character, data).level).toBe(2);
    expect(r.character.foci.at(-1)).toEqual({ id: 'die-hard', level: 1 });
    expect(r.character.advancement).toEqual({ skillPoints: 3, quickPoints: 0, skillCredit: {} });
    // Two dice of 1d6+2 rolling 6s, Con +0, Die Hard +2 each: 20 beats 8.
    expect(r.hpRolled).toBe(20);
    expect(r.character.hp).toEqual({ max: 20, current: 20 });
    const low = ok(
      advance(data, snag, { ...none, foci: [{ id: 'die-hard' }] }, scriptedRng([1, 1])),
    );
    expect(low.character.hp).toEqual({ max: 10, current: 10 });
  });

  it('raises a held focus, up to its last level', () => {
    const snag = withXp(starter('snag'), 3);
    const r = ok(advance(data, snag, { ...none, foci: [{ id: 'alert' }] }, scriptedRng([1, 1])));
    expect(r.character.foci.find((f) => f.id === 'alert')?.level).toBe(2);
    const maxed = {
      ...snag,
      foci: snag.foci.map((f) => (f.id === 'alert' ? { ...f, level: 2 } : f)),
    };
    expect(advance(data, maxed, { ...none, foci: [{ id: 'alert' }] }, scriptedRng([]))).toEqual({
      ok: false,
      reason: 'Alert has no next level',
    });
  });

  it('turns a new focus’s bonus skill into three skill points (2.7.1.6)', () => {
    const snag = withXp(starter('snag'), 3);
    const take = (choice: LevelChoices['foci'][number]) =>
      advance(data, snag, { ...none, foci: [choice] }, scriptedRng([1, 1]));
    // Sneak 1 → 2 costs exactly 3, even below the 3rd level a skill-2 normally needs.
    expect(ok(take({ id: 'assassin' })).character.skills.sneak).toBe(2);
    // Shoot from nothing: level-0 for 1, level-1 for 2.
    expect(ok(take({ id: 'deadeye' })).character.skills.shoot).toBe(1);
    expect(take({ id: 'polymath' })).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/^Polymath needs one of: /),
    });
    expect(take({ id: 'shocking-assault', skill: 'shoot' })).toMatchObject({ ok: false });
    expect(ok(take({ id: 'polymath', skill: 'craft' })).character.skills.craft).toBe(1);
  });

  it('refuses foci that can’t be picked or don’t fit', () => {
    const snag = withXp(starter('snag'), 3);
    const take = (choice: LevelChoices['foci'][number], c = snag) =>
      advance(data, c, { ...none, foci: [choice] }, scriptedRng([1, 1]));
    expect(take({ id: 'special-origin' })).toEqual({
      ok: false,
      reason: "special-origin can't be picked",
    });
    expect(take({ id: 'warren-born' })).toEqual({
      ok: false,
      reason: "warren-born can't be picked",
    });
    expect(take({ id: 'nope' })).toEqual({ ok: false, reason: "nope can't be picked" });
    expect(take({ id: 'armored-magic' })).toEqual({
      ok: false,
      reason: 'Armored Magic is only for spellcasters',
    });
    expect(take({ id: 'developed-attribute' })).toEqual({
      ok: false,
      reason: 'Developed Attribute needs an attribute',
    });
    const dev = ok(take({ id: 'developed-attribute', attribute: 'str' })).character;
    expect(dev.foci.at(-1)).toEqual({ id: 'developed-attribute', level: 1, attribute: 'str' });
    const fourth = { ...dev, xp: 18, classes: { ...dev.classes, levels: { 'full-warrior': 4 } } };
    expect(take({ id: 'developed-attribute', attribute: 'str' }, fourth)).toMatchObject({
      ok: false,
    });
    const adventurer = switched('partial-expert-partial-warrior');
    const picks = (foci: LevelChoices['foci']) =>
      advance(data, adventurer, { ...none, foci }, scriptedRng([1, 1, 1, 1, 1]));
    expect(picks([{ id: 'lucky' }, { id: 'lucky' }, { id: 'lucky' }])).toEqual({
      ok: false,
      reason: "Lucky doesn't fit a warrior pick",
    });
    expect(picks([{ id: 'die-hard' }, { id: 'die-hard' }, { id: 'well-met' }])).toEqual({
      ok: false,
      reason: "Die Hard doesn't fit a expert pick",
    });
  });

  it('starts a new class at its first level: its foci, abilities, and Quick Learner', () => {
    const adventurer = switched('partial-expert-partial-warrior');
    const plan = levelPlan(data, adventurer);
    expect(plan).toMatchObject({
      classLevel: 1,
      focusPicks: ['warrior', 'expert', 'any'],
      quickPoints: 1,
    });
    const r = ok(
      advance(
        data,
        adventurer,
        { ...none, foci: [{ id: 'die-hard' }, { id: 'well-met' }, { id: 'impervious-defense' }] },
        scriptedRng([1, 1, 1, 1, 1]),
      ),
    );
    expect(r.character.classes.levels).toEqual({
      'full-warrior': 4,
      'partial-expert-partial-warrior': 1,
    });
    expect(characterSheet(r.character, data).level).toBe(5);
  });
});

describe('spells and arts at a new level (SRD 2.7.1.7)', () => {
  const fizz = withXp(starter('fizzwick'), 3);
  const learn = (arts: string[], spells: string[], c = fizz) =>
    advance(data, c, { foci: [{ id: 'die-hard' }], arts, spells }, scriptedRng([1, 1]));
  const two = ['ineluctable-shackles-of-volition', 'decree-of-ligneous-dissolution'];

  it('takes the tradition’s art picks', () => {
    expect(learn([], two)).toEqual({ ok: false, reason: 'pick 1 high-mage arts' });
    expect(learn(['elemental-sparks'], two)).toEqual({
      ok: false,
      reason: 'pick 1 high-mage arts',
    });
    expect(learn(['swift-casting', 'elemental-sparks'], two)).toEqual({
      ok: false,
      reason: 'pick 1 arts',
    });
    expect(learn(['empowered-sorcery'], two)).toEqual({
      ok: false,
      reason: 'each art can be learned once',
    });
  });

  it('learns two High Magic spells a level, none above the castable level', () => {
    expect(learn(['swift-casting'], [])).toEqual({ ok: false, reason: 'learn 2 spells' });
    expect(learn(['swift-casting'], ['the-coruscating-coffin', 'phantasmal-mimesis'])).toEqual({
      ok: false,
      reason: "the-coruscating-coffin can't be learned now",
    });
    expect(learn(['swift-casting'], ['phantasmal-mimesis', 'phantasmal-mimesis'])).toMatchObject({
      ok: false,
    });
    const r = ok(learn(['swift-casting'], two));
    expect(r.character.arts).toEqual(['empowered-sorcery', 'inexorable-effect', 'swift-casting']);
    expect(r.character.spells.known.slice(-2)).toEqual(two);
    expect(r.character.spells.prepared).toHaveLength(3);
  });

  it('teaches no spells to non-casters', () => {
    const snag = withXp(starter('snag'), 3);
    expect(
      advance(
        data,
        snag,
        { foci: [{ id: 'die-hard' }], arts: [], spells: ['phantasmal-mimesis'] },
        scriptedRng([]),
      ),
    ).toEqual({ ok: false, reason: 'learn 0 spells' });
  });

  it('gives a new Mage class its starting spells and tradition skill as three points', () => {
    const mage = switched('full-high-mage');
    const plan = levelPlan(data, mage);
    expect(plan).toMatchObject({ classLevel: 1, spells: 4, bonusSkills: ['magic'] });
    const spells = [
      'ineluctable-shackles-of-volition',
      'decree-of-ligneous-dissolution',
      'the-coruscating-coffin',
      'wardpact-invocation',
    ];
    const choices = {
      foci: [{ id: 'die-hard' }],
      arts: ['swift-casting', 'counter-magic'],
      spells,
    };
    const r = ok(advance(data, mage, choices, scriptedRng([1, 1, 1, 1, 1])));
    expect(r.character.skills.magic).toBe(1);
    expect(characterSheet(r.character, data).magic).not.toBeNull();
  });
});

describe('level-gated arts (Phase 14d)', () => {
  /** Fizzwick as a Priest of Death of `level`, with XP for the next. */
  function priest(level: number): Character {
    const fizz = starter('fizzwick');
    return {
      ...fizz,
      xp: xpForLevel(level + 1),
      classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': level } },
      skills: { ...fizz.skills, heal: 1 },
      arts: ['healing-touch'],
      spells: { known: [], prepared: [] },
    };
  }

  /** The level's picks, with `healer` as the Healer art and the first open others. */
  function choices(c: Character, healer: string): LevelChoices {
    const plan = levelPlan(data, c) as LevelPlan;
    const mage = (classOption(data, plan.classId) as ClassOption).mage as NonNullable<
      ClassOption['mage']
    >;
    return {
      foci: [],
      arts: plan.arts.flatMap((p) =>
        p.tradition === 'healer'
          ? [healer]
          : artChoices(data, p, c.arts, plan.classLevel)
              .slice(0, p.picks)
              .map((a) => a.id),
      ),
      spells: learnableSpells(data, mage, plan.maxSpellLevel)
        .slice(0, plan.spells)
        .map((s) => s.id),
    };
  }

  it('refuses Revive the Fallen before 8th level, and takes it at 8th', () => {
    const young = priest(3);
    expect(advance(data, young, choices(young, 'revive-the-fallen'), scriptedRng([1]))).toEqual({
      ok: false,
      reason: 'revive-the-fallen waits for a higher level',
    });
    const old = priest(7);
    expect(advance(data, old, choices(old, 'limb-restoration'), createRng('old'))).toEqual({
      ok: false,
      reason: "limb-restoration isn't used in this game",
    });
    const r = ok(advance(data, old, choices(old, 'revive-the-fallen'), createRng('old')));
    expect(r.character.arts).toContain('revive-the-fallen');
  });
});
