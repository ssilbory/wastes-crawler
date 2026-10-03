import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import type { People, Progression } from '../../src/data/schemas/index.ts';
import { findProgression, type GameData } from '../../src/game/character/context.ts';
import {
  emptyChoices,
  evaluateChoices,
  finishCharacter,
  type Choices,
} from '../../src/game/character/creation.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import {
  allowedSkills,
  evaluateFoci,
  focusInfo,
  focusSlots,
  hasDieHard,
  modifierBonuses,
  type FocusChoice,
} from '../../src/game/character/foci.ts';
import { findLineage, findPeople } from '../../src/game/character/people.ts';
import type { Skills } from '../../src/game/character/skills.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const data: GameData = { srd: loadSrd(), content: loadContent() };
const people = (id: string) => findPeople(data, id) as People;
const cls = (id: string) => findProgression(data, id) as Progression;

/** Slots for a people and class, evaluated against the given starting skills. */
function evaluate(
  peopleId: string,
  classId: string,
  choices: (FocusChoice | null)[],
  skills: Skills = {},
) {
  return evaluateFoci(data, focusSlots(people(peopleId), undefined, cls(classId)), choices, skills);
}

// Goblin Warrior: two signature foci, one racial pick, then a combat pick and an any pick.
const goblin = (combat: FocusChoice | null, any: FocusChoice | null, racial = 'alert') => [
  null,
  null,
  { id: racial },
  combat,
  any,
];

describe('focusSlots', () => {
  it('lists signature foci, racial fill-ins, then the class picks (SRD 1.6.0)', () => {
    expect(focusSlots(people('goblin'), undefined, cls('full-warrior')).map((s) => s.kind)).toEqual(
      ['signature', 'signature', 'racial', 'combat', 'any'],
    );
    expect(focusSlots(people('elf'), undefined, cls('full-expert')).map((s) => s.kind)).toEqual([
      'signature',
      'racial',
      'racial',
      'non-combat',
      'any',
    ]);
    const adventurer = focusSlots(people('orc'), undefined, cls('partial-expert-partial-warrior'));
    expect(adventurer.slice(3).map((s) => s.kind)).toEqual(['combat', 'non-combat', 'any']);
  });

  it('adds the lineage signature focus, and gives only racial slots without a class', () => {
    const centaur = people('centaur');
    const slots = focusSlots(centaur, findLineage(centaur, 'lion'), undefined);
    expect(slots).toEqual([
      { kind: 'signature', fixed: 'four-legged' },
      { kind: 'signature', fixed: 'pounce' },
      { kind: 'racial', options: centaur.racialFocusPicks },
    ]);
  });
});

describe('focusInfo', () => {
  it('merges SRD foci with their rules, and describes racial foci', () => {
    expect(focusInfo(data, 'alert')).toMatchObject({
      name: 'Alert',
      category: 'both',
      bonusSkill: { kind: 'skill', skill: 'notice' },
      pickable: true,
    });
    expect(focusInfo(data, 'die-hard')).toMatchObject({ dieHard: true, category: 'combat' });
    expect(focusInfo(data, 'warren-born')).toMatchObject({ category: null, pickable: false });
    expect(focusInfo(data, 'flying')).toBeUndefined();
  });
});

describe('evaluateFoci', () => {
  it('builds a Goblin Warrior, granting each first-level bonus skill', () => {
    const r = evaluate('goblin', 'full-warrior', goblin({ id: 'armsmaster' }, { id: 'lucky' }), {
      stab: 0,
    });
    expect(r.status).toEqual({ state: 'ok' });
    expect(r.foci.map((f) => f.id)).toEqual([
      'warren-born',
      'scrounger',
      'alert',
      'armsmaster',
      'lucky',
    ]);
    expect(r.skills).toEqual({ sneak: 0, survive: 0, notice: 0, stab: 1 });
    expect(r.skillsBefore[3]).toEqual({ stab: 0, sneak: 0, survive: 0, notice: 0 });
    expect(allowedSkills(data, { kind: 'any-combat' })).toEqual(['stab', 'shoot', 'punch']);
  });

  it('stays incomplete until every pick is made, and refuses extra picks', () => {
    expect(evaluate('goblin', 'full-warrior', goblin({ id: 'armsmaster' }, null)).status).toEqual({
      state: 'incomplete',
    });
    const six = [...goblin({ id: 'armsmaster' }, { id: 'lucky' }), { id: 'lucky' }];
    expect(evaluate('goblin', 'full-warrior', six).status).toMatchObject({
      message: 'expected 5 foci',
    });
  });

  it('checks signature, racial, and class slots', () => {
    const msg = (choices: (FocusChoice | null)[], classId = 'full-warrior', p = 'goblin') => {
      const s = evaluate(p, classId, choices).status;
      return s.state === 'error' ? s.message : s.state;
    };
    expect(msg([{ id: 'scrounger' }])).toBe('wrong signature focus');
    expect(msg([null, null, { id: 'flying' }])).toBe('unknown focus flying');
    expect(msg([null, null, { id: 'lucky' }])).toBe("Lucky isn't on your people's list");
    expect(msg([null, { id: 'deadeye' }, { id: 'deadeye' }], 'full-warrior', 'elf')).toBe(
      'Deadeye is already one of your racial foci',
    );
    expect(msg(goblin({ id: 'alert' }, null))).toBe('Alert is one of your racial foci');
    expect(msg(goblin({ id: 'horned' }, null))).toBe("Horned can't be picked in this version");
    expect(msg(goblin({ id: 'armored-magic' }, null))).toBe(
      'Armored Magic is only for spellcasters',
    );
    expect(msg(goblin({ id: 'spirit-familiar' }, null))).toBe(
      "Spirit Familiar can't be picked in this version",
    );
    expect(msg(goblin({ id: 'lucky' }, null))).toBe("Lucky isn't a combat focus");
    expect(msg([null, null, { id: 'alert' }, { id: 'armsmaster' }], 'full-expert')).toBe(
      "Armsmaster isn't a non-combat focus",
    );
    // Rider counts as both, so it fills a combat or a non-combat pick.
    expect(msg(goblin({ id: 'rider' }, null, 'trapmaster'))).toBe('incomplete');
    expect(msg([null, null, { id: 'alert' }, { id: 'rider' }], 'full-expert')).toBe('incomplete');
  });

  it('raises a second pick of a focus to level 2 without another bonus skill', () => {
    const r = evaluate(
      'goblin',
      'full-warrior',
      goblin({ id: 'armsmaster' }, { id: 'armsmaster' }),
    );
    expect(r.status).toEqual({ state: 'ok' });
    expect(r.foci.find((f) => f.id === 'armsmaster')).toEqual({ id: 'armsmaster', level: 2 });
    expect(r.skills.stab).toBe(0);
    const thrice = [null, null, { id: 'alert' }, { id: 'rider' }, { id: 'rider' }, { id: 'rider' }];
    expect(evaluate('goblin', 'partial-expert-partial-warrior', thrice).status).toMatchObject({
      message: 'Rider has no next level',
    });
  });

  it('applies Developed Attribute once per attribute', () => {
    const dev = (attribute?: 'str' | 'dex') => ({
      id: 'developed-attribute',
      ...(attribute ? { attribute } : {}),
    });
    const expert = (a: FocusChoice, b: FocusChoice) => [null, null, { id: 'alert' }, a, b];
    expect(evaluate('goblin', 'full-expert', expert(dev(), dev('dex'))).status).toEqual({
      state: 'incomplete',
    });
    expect(evaluate('goblin', 'full-expert', expert(dev('dex'), dev('dex'))).status).toMatchObject({
      message: 'Developed Attribute already improves dex',
    });
    const r = evaluate('goblin', 'full-expert', expert(dev('str'), dev('dex')));
    expect(r.status).toEqual({ state: 'ok' });
    expect(r.bonuses).toEqual({ str: 1, dex: 1 });
    expect(modifierBonuses(r.foci)).toEqual({ str: 1, dex: 1 });
  });

  it('resolves bonus skill choices and replacements (SRD 1.2.2)', () => {
    const pick = (choice: FocusChoice, skills: Skills = {}) => {
      const s = evaluate('goblin', 'full-warrior', goblin(choice, { id: 'lucky' }), skills);
      return s.status.state === 'error' ? s.status.message : s.status.state;
    };
    expect(pick({ id: 'shocking-assault' })).toBe('incomplete');
    expect(pick({ id: 'shocking-assault', skill: 'shoot' })).toBe(
      "Shocking Assault can't give shoot",
    );
    expect(pick({ id: 'shocking-assault', skill: 'punch' }, { punch: 1 })).toBe(
      'punch is already level-1; choose another skill',
    );
    expect(pick({ id: 'shocking-assault', skill: 'stab' }, { punch: 1 })).toBe('ok');
    // Every offered skill is already level-1, so any other skill may replace it.
    expect(pick({ id: 'shocking-assault', skill: 'heal' }, { punch: 1, stab: 1 })).toBe('ok');
    expect(pick({ id: 'shocking-assault', skill: 'juggle' }, { punch: 1, stab: 1 })).toBe(
      "Shocking Assault can't give juggle",
    );
    expect(pick({ id: 'close-combatant', skill: 'shoot' })).toBe('ok');
    expect(pick({ id: 'close-combatant', skill: 'heal' })).toBe("Close Combatant can't give heal");
    const expert = (choice: FocusChoice) =>
      evaluate('goblin', 'full-expert', [null, null, { id: 'alert' }, choice, { id: 'lucky' }])
        .status;
    expect(expert({ id: 'polymath', skill: 'ride' })).toEqual({ state: 'ok' });
    expect(expert({ id: 'specialist', skill: 'magic' })).toMatchObject({
      message: "Specialist can't give magic",
    });
    expect(expert({ id: 'specialist', skill: 'trade' })).toEqual({ state: 'ok' });
  });

  it('marks Die Hard', () => {
    expect(hasDieHard(data, [{ id: 'die-hard', level: 1 }])).toBe(true);
    expect(hasDieHard(data, [{ id: 'flying', level: 1 }])).toBe(false);
  });
});

describe('foci in a finished character', () => {
  const base = (foci: (FocusChoice | null)[]): Choices => ({
    ...emptyChoices(),
    people: 'orc',
    array: { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 },
    background: { id: 'raider', choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] } },
    classId: 'full-expert',
    foci,
    gear: { mode: 'package', packageId: 'shield-wall' },
    freeSkill: 'heal',
    name: 'Grukk',
  });

  it('adds Die Hard to the HP roll and Developed Attribute to modifiers and saves', () => {
    const plain = finishCharacter(
      base([
        { id: 'war-bred', skill: 'stab' },
        null,
        { id: 'authority' },
        { id: 'lucky' },
        { id: 'well-met' },
      ]),
      data,
      scriptedRng([3, 1, 2]),
    );
    const tough = finishCharacter(
      base([
        { id: 'war-bred', skill: 'stab' },
        null,
        { id: 'die-hard' },
        { id: 'developed-attribute', attribute: 'con' },
        { id: 'developed-attribute', attribute: 'wis' },
      ]),
      data,
      scriptedRng([3, 1, 2]),
    );
    if (!plain.ok || !tough.ok) throw new Error('expected both to finish');
    // Orc Con 12 is +0; Developed Attribute makes it +1, and Die Hard adds 2.
    expect(tough.character.hp.max - plain.character.hp.max).toBe(3);
    const sheet = characterSheet(tough.character, data);
    expect(sheet.modifiers).toMatchObject({ con: 1, wis: 1 });
    expect(sheet.saves.mental).toBe(characterSheet(plain.character, data).saves.mental - 1);
  });

  it('holds back foci until the background and class are valid', () => {
    const ev = evaluateChoices({ ...base([]), classId: null }, data);
    expect(ev.focusSlots.map((s) => s.kind)).toEqual(['signature', 'signature', 'racial']);
    expect(ev.steps.foci).toEqual({ state: 'incomplete' });
  });
});
