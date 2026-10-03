import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import type { Character } from '../../src/data/schemas/index.ts';
import type { GameData } from '../../src/game/character/context.ts';
import { emptyChoices, finishCharacter } from '../../src/game/character/creation.ts';
import { characterSheet, previewSheet } from '../../src/game/character/derived.ts';
import { evaluateChoices } from '../../src/game/character/creation.ts';
import { exportCharacter, importCharacter } from '../../src/game/character/io.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const data: GameData = { srd: loadSrd(), content: loadContent() };

function goblinWarrior(): Character {
  const r = finishCharacter(
    {
      ...emptyChoices(),
      people: 'goblin',
      array: { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 },
      background: { id: 'raider', choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] } },
      classId: 'full-warrior',
      freeSkill: 'notice',
      name: 'Snag',
      goal: '',
    },
    data,
    scriptedRng([4, 1, 2]),
  );
  if (!r.ok) throw new Error(r.errors.join('; '));
  return r.character;
}

describe('characterSheet', () => {
  it('derives scores, modifiers, attack bonus, saves, and strain maximum', () => {
    expect(characterSheet(goblinWarrior(), data)).toEqual({
      scores: { str: 12, dex: 14, con: 11, int: 11, wis: 9, cha: 7 },
      modifiers: { str: 0, dex: 1, con: 0, int: 0, wis: 0, cha: -1 },
      level: 1,
      attackBonus: 1,
      saves: { physical: 15, evasion: 14, mental: 15, luck: 15 },
      strainMax: 11,
      size: 'small',
    });
  });
});

describe('previewSheet', () => {
  it('shows nothing until scores exist, and an attack bonus once a valid class is chosen', () => {
    const empty = emptyChoices();
    expect(previewSheet(evaluateChoices(empty, data), null, data)).toEqual({
      scores: null,
      modifiers: null,
      attackBonus: null,
      saves: null,
    });
    const withArray = {
      ...empty,
      people: 'goblin',
      array: { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 },
      classId: 'full-warrior',
    };
    expect(previewSheet(evaluateChoices(withArray, data), withArray.classId, data)).toMatchObject({
      modifiers: { dex: 1, cha: -1 },
      attackBonus: 1,
      saves: { physical: 15, evasion: 14, mental: 15, luck: 15 },
    });
    const badClass = { ...withArray, classId: 'full-high-mage' };
    expect(
      previewSheet(evaluateChoices(badClass, data), badClass.classId, data).attackBonus,
    ).toBeNull();
  });
});

describe('export and import', () => {
  it('round-trips a character', () => {
    const c = goblinWarrior();
    expect(importCharacter(exportCharacter(c), data)).toEqual({ ok: true, character: c });
  });

  it('accepts hand-edited values that fit the schema', () => {
    const edited = { ...goblinWarrior(), hp: { max: 40, current: 40 }, skills: { stab: 4 } };
    expect(importCharacter(JSON.stringify(edited), data)).toMatchObject({ ok: true });
  });

  it('rejects files that are not character JSON', () => {
    expect(importCharacter('{nope', data)).toMatchObject({
      ok: false,
      errors: [expect.stringMatching(/^not valid JSON/)],
    });
    expect(importCharacter('[1]', data)).toEqual({ ok: false, errors: ['not a character file'] });
    expect(importCharacter('null', data)).toEqual({ ok: false, errors: ['not a character file'] });
    expect(importCharacter('{}', data)).toEqual({
      ok: false,
      errors: ['schemaVersion is missing'],
    });
  });

  it('rejects newer versions and versions with no upgrade path', () => {
    const c = goblinWarrior();
    expect(importCharacter(JSON.stringify({ ...c, schemaVersion: 2 }), data)).toMatchObject({
      errors: ['made by a newer version of the game (schema 2)'],
    });
    expect(importCharacter(JSON.stringify({ ...c, schemaVersion: 0 }), data)).toMatchObject({
      errors: ['no upgrade from schema 0'],
    });
  });

  it('upgrades older files through the migrations in order', () => {
    const { goal, ...v0 } = { ...goblinWarrior(), schemaVersion: 0 };
    const addGoal = (raw: Record<string, unknown>) => ({
      ...raw,
      goal: goal || '(none)',
      schemaVersion: 1,
    });
    expect(importCharacter(JSON.stringify(v0), data, { 0: addGoal })).toMatchObject({
      ok: true,
      character: { goal: '(none)' },
    });
  });

  it('lists schema errors by field', () => {
    const r = importCharacter(
      JSON.stringify({ ...goblinWarrior(), hp: { max: 0, current: 0 }, extra: 1 }),
      data,
    );
    expect(r).toMatchObject({ ok: false });
    expect(r.ok ? [] : r.errors).toEqual(
      expect.arrayContaining([
        expect.stringMatching(/^hp\.max:/),
        expect.stringMatching(/^\(file\):/),
      ]),
    );
  });

  it('rejects references to data that does not exist', () => {
    const c = goblinWarrior();
    const bad = {
      ...c,
      people: 'dwarf',
      background: 'pirate',
      skills: { juggle: 0 },
      classes: { current: 'full-mage', levels: { 'full-wizard': 1 } },
    };
    expect(importCharacter(JSON.stringify(bad), data)).toEqual({
      ok: false,
      errors: [
        'people: unknown dwarf',
        'background: unknown pirate',
        'skills: unknown juggle',
        'classes: unknown full-wizard',
        'classes.current: full-mage has no level entry',
      ],
    });
  });
});
