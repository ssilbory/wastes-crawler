import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import type { Character } from '../../src/data/schemas/index.ts';
import type { GameData } from '../../src/game/character/context.ts';
import { emptyChoices, finishCharacter } from '../../src/game/character/creation.ts';
import { characterSheet, previewSheet } from '../../src/game/character/derived.ts';
import { evaluateChoices } from '../../src/game/character/creation.ts';
import { exportCharacter, importCharacter, MIGRATIONS } from '../../src/game/character/io.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';
import { WORLD_LISTENERS } from '../../src/game/world/listeners.ts';

const data: GameData = { srd: loadSrd(), content: loadContent(), listeners: WORLD_LISTENERS };
const d2 = { count: 1, sides: 2, modifier: 0 };
const d4 = { count: 1, sides: 4, modifier: 0 };
const d6 = { count: 1, sides: 6, modifier: 0 };

function goblinWarrior(): Character {
  const r = finishCharacter(
    {
      ...emptyChoices(),
      people: 'goblin',
      array: { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 },
      background: { id: 'raider', choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] } },
      classId: 'full-warrior',
      foci: [null, null, { id: 'alert' }, { id: 'armsmaster' }, { id: 'lucky' }],
      gear: { mode: 'package', packageId: 'shield-wall' },
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
      // Hand-computed: Shield Wall gives small cuirass and greaves (15) and a large shield
      // (15 or +2), so max(15, 17) + Dex 1 = 18. Armsmaster adds Stab-1 to melee and thrown
      // damage and melee Shock, but not to unarmed attacks.
      equipment: {
        armorClass: 18,
        armorClassInput: {
          armorAc: 15,
          shield: expect.objectContaining({ baseAc: 15, bonus: 2 }),
          dexModifier: 1,
        },
        attacks: [
          {
            id: 'spear-light',
            name: 'Spear, Light',
            mode: 'melee',
            hit: 3,
            damage: d6,
            damageBonus: 2,
            shock: { damage: 4, maxAc: 13 },
          },
          {
            id: 'spear-light',
            name: 'Spear, Light',
            mode: 'thrown',
            hit: 3,
            damage: d6,
            damageBonus: 2,
            shock: null,
          },
          {
            id: 'dagger',
            name: 'Dagger',
            mode: 'melee',
            hit: 3,
            damage: d4,
            damageBonus: 2,
            shock: { damage: 3, maxAc: 15 },
          },
          {
            id: 'dagger',
            name: 'Dagger',
            mode: 'thrown',
            hit: 3,
            damage: d4,
            damageBonus: 2,
            shock: null,
          },
          {
            id: 'unarmed-attack',
            name: 'Unarmed Attack',
            mode: 'melee',
            hit: 0,
            damage: d2,
            damageBonus: 1,
            shock: null,
          },
        ],
        load: { readied: 5, stowed: 6, readiedLimit: 6, stowedLimit: 12, excess: 0, state: 'ok' },
      },
      magic: null,
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
    const badClass = { ...withArray, classId: 'partial-expert-partial-mage' };
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
    expect(importCharacter(JSON.stringify({ ...c, schemaVersion: 8 }), data)).toMatchObject({
      errors: ['made by a newer version of the game (schema 8)'],
    });
    expect(importCharacter(JSON.stringify({ ...c, schemaVersion: 0 }), data)).toMatchObject({
      errors: ['no upgrade from schema 0'],
    });
  });

  it('upgrades older files through the migrations in order', () => {
    const { goal, ...v0 } = { ...goblinWarrior(), schemaVersion: 0, foci: undefined };
    const addGoal = (raw: Record<string, unknown>) => ({
      ...raw,
      goal: goal || '(none)',
      schemaVersion: 1,
    });
    expect(importCharacter(JSON.stringify(v0), data, { ...MIGRATIONS, 0: addGoal })).toMatchObject({
      ok: true,
      character: { goal: '(none)', foci: [] },
    });
  });

  it('upgrades a version 1 file, made before foci, to an empty focus list', () => {
    const v1 = { ...goblinWarrior(), schemaVersion: 1, foci: undefined };
    expect(importCharacter(JSON.stringify(v1), data)).toMatchObject({
      ok: true,
      character: { schemaVersion: 7, foci: [], inventory: [], crowns: 0, arts: [] },
    });
  });

  it('upgrades a version 4 file with no attribute boosts or saved skill points', () => {
    const c = goblinWarrior();
    const attributes: Record<string, unknown> = { ...c.attributes };
    delete attributes.advancement;
    const v4: Record<string, unknown> = { ...c, attributes, schemaVersion: 4 };
    delete v4.advancement;
    expect(importCharacter(JSON.stringify(v4), data)).toEqual({ ok: true, character: c });
  });

  it('rejects unknown arts and spells', () => {
    const c = {
      ...goblinWarrior(),
      arts: ['juggling'],
      spells: { known: ['fireball'], prepared: [] },
    };
    expect(importCharacter(JSON.stringify(c), data)).toEqual({
      ok: false,
      errors: ['arts: unknown juggling', 'spells: unknown fireball'],
    });
  });

  it('rejects unknown items', () => {
    const c = {
      ...goblinWarrior(),
      inventory: [{ id: 'jetpack', quantity: 1, location: 'stowed' }],
    };
    expect(importCharacter(JSON.stringify(c), data)).toEqual({
      ok: false,
      errors: ['inventory: unknown jetpack'],
    });
  });

  it('rejects classes the game no longer offers', () => {
    const c = {
      ...goblinWarrior(),
      classes: { current: 'high-mage-partial-warrior', levels: { 'high-mage-partial-warrior': 1 } },
    };
    expect(importCharacter(JSON.stringify(c), data)).toEqual({
      ok: false,
      errors: ['classes: unknown high-mage-partial-warrior'],
    });
  });

  it('rejects unknown foci', () => {
    const c = { ...goblinWarrior(), foci: [{ id: 'flying', level: 1 }] };
    expect(importCharacter(JSON.stringify(c), data)).toEqual({
      ok: false,
      errors: ['foci: unknown flying'],
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
