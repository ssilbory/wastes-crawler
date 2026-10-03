import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import type { GameData } from '../../src/game/character/context.ts';
import {
  emptyChoices,
  evaluateChoices,
  finishCharacter,
  type Choices,
} from '../../src/game/character/creation.ts';
import { characterSheet } from '../../src/game/character/derived.ts';
import { exportCharacter, importCharacter } from '../../src/game/character/io.ts';
import { backgroundOpenTo, evaluatePeople } from '../../src/game/character/people.ts';
import type { AttributeScores } from '../../src/rules/attributes.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const data: GameData = { srd: loadSrd(), content: loadContent() };
const array: AttributeScores = { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 };

// The Peoples table in docs/rules-adaptation.md.
const EXPECTED = [
  { people: 'goblin', lineage: null, adjust: { dex: 2, int: 1, str: -2 }, size: 'small' },
  { people: 'orc', lineage: null, adjust: { str: 2, con: 1, cha: -2 }, size: 'standard' },
  { people: 'elf', lineage: null, adjust: { dex: 2, cha: 1, str: -2 }, size: 'standard' },
  { people: 'centaur', lineage: 'deer', adjust: { dex: 1 }, size: 'large' },
  { people: 'centaur', lineage: 'goat', adjust: { str: 1, con: 1, cha: -1 }, size: 'large' },
  { people: 'centaur', lineage: 'lion', adjust: { str: 2, wis: -1 }, size: 'large' },
  { people: 'centaur', lineage: 'bison', adjust: { str: 1, con: 1, dex: -1 }, size: 'large' },
  { people: 'beastman', lineage: null, adjust: { con: 2, str: 1, int: -2 }, size: 'standard' },
  { people: 'gnome', lineage: null, adjust: { int: 2, wis: 1, str: -2 }, size: 'small' },
] as const;

/** A complete Warrior of the given people, using the first background open to it. */
function choicesFor(people: string, lineage: string | null): Choices {
  const bg = data.content.backgrounds.find((b) => backgroundOpenTo(b, people));
  if (!bg) throw new Error(`no background for ${people}`);
  return {
    ...emptyChoices(),
    people,
    lineage,
    array,
    background: { id: bg.id, choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] } },
    classId: 'full-warrior',
    freeSkill: 'heal',
    name: 'Tester',
  };
}

describe('every people and lineage', () => {
  it.each(EXPECTED)('builds, saves, and reloads a $people $lineage', (e) => {
    const choices = choicesFor(e.people, e.lineage);
    const ev = evaluateChoices(choices, data);
    expect(ev.complete).toBe(true);
    expect(ev.peopleAdjust).toEqual(e.adjust);

    const r = finishCharacter(choices, data, scriptedRng([5, 1, 2]));
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.character.people).toBe(e.people);
    expect(r.character.lineage).toBe(e.lineage ?? undefined);
    expect(characterSheet(r.character, data).size).toBe(e.size);
    expect(importCharacter(exportCharacter(r.character), data)).toEqual({
      ok: true,
      character: r.character,
    });
  });

  it('covers every people and lineage in the data', () => {
    const all = data.content.peoples.flatMap((p) =>
      p.lineages ? p.lineages.map((l) => `${p.id}/${l.id}`) : [p.id],
    );
    expect(all).toEqual(EXPECTED.map((e) => (e.lineage ? `${e.people}/${e.lineage}` : e.people)));
  });
});

describe('evaluatePeople', () => {
  it('needs a people, and a lineage only when the people has them', () => {
    expect(evaluatePeople(data, '', null).status).toEqual({ state: 'incomplete' });
    expect(evaluatePeople(data, 'centaur', null)).toEqual({
      status: { state: 'incomplete' },
      modifiers: null,
    });
    expect(evaluatePeople(data, 'centaur', 'horse').status).toEqual({
      state: 'error',
      message: 'unknown Centaur lineage horse',
    });
    expect(evaluatePeople(data, 'goblin', 'deer').status).toEqual({
      state: 'error',
      message: 'the Goblin people has no lineages',
    });
  });

  it('holds back final scores until the people step is valid', () => {
    const ev = evaluateChoices(choicesFor('centaur', null), data);
    expect(ev.steps.people).toEqual({ state: 'incomplete' });
    expect(ev.steps.attributes).toEqual({ state: 'ok' });
    expect(ev.scores).toBeNull();
    expect(ev.steps.background).toEqual({ state: 'incomplete' });
  });

  it('adds the lineage modifiers on top of the people', () => {
    const lion = evaluateChoices(choicesFor('centaur', 'lion'), data);
    expect(lion.scores).toMatchObject({ str: 16, wis: 8 });
  });
});

describe('backgrounds by people', () => {
  it('refuses a background that is not open to the people', () => {
    const tunnelingCentaur = {
      ...choicesFor('centaur', 'goat'),
      background: { id: 'tunneler', choice: { mode: 'pick' as const, picks: [] } },
    };
    expect(evaluateChoices(tunnelingCentaur, data).steps.background).toEqual({
      state: 'error',
      message: "Tunneler isn't open to centaur",
    });
    const outriderGoblin = {
      ...choicesFor('goblin', null),
      background: { id: 'outrider', choice: { mode: 'pick' as const, picks: [] } },
    };
    expect(evaluateChoices(outriderGoblin, data).steps.background).toMatchObject({
      state: 'error',
    });
  });

  it('opens untagged backgrounds to every people', () => {
    const raider = data.content.backgrounds.find((b) => b.id === 'raider');
    if (!raider) throw new Error('no raider');
    expect(data.content.peoples.every((p) => backgroundOpenTo(raider, p.id))).toBe(true);
  });
});

describe('importing lineages', () => {
  const centaur = () => {
    const r = finishCharacter(choicesFor('centaur', 'bison'), data, scriptedRng([5, 1, 2]));
    if (!r.ok) throw new Error(r.errors.join('; '));
    return r.character;
  };

  it('requires a known lineage for centaurs and none for other peoples', () => {
    const noLineage = { ...centaur(), lineage: undefined };
    expect(importCharacter(JSON.stringify(noLineage), data)).toEqual({
      ok: false,
      errors: ['lineage: Centaur characters need one'],
    });
    expect(importCharacter(JSON.stringify({ ...centaur(), lineage: 'horse' }), data)).toEqual({
      ok: false,
      errors: ['lineage: unknown Centaur lineage horse'],
    });
    expect(
      importCharacter(JSON.stringify({ ...centaur(), people: 'orc', lineage: 'bison' }), data),
    ).toEqual({ ok: false, errors: ['lineage: unknown Orc lineage bison'] });
  });

  it('throws when a sheet is asked for an unknown people', () => {
    expect(() => characterSheet({ ...centaur(), people: 'dwarf' }, data)).toThrow(
      'unknown people dwarf',
    );
  });
});
