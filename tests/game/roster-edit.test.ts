import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import type { Character } from '../../src/data/schemas/index.ts';
import { FREE_REROLLS } from '../../src/game/character/attributes.ts';
import type { GameData } from '../../src/game/character/context.ts';
import {
  emptyChoices,
  evaluateChoices,
  finishCharacter,
  type Choices,
} from '../../src/game/character/creation.ts';
import {
  asEdit,
  editPlan,
  importToRoster,
  recoverChoices,
  saveBuilt,
  saveDetails,
  sameName,
} from '../../src/game/character/roster-edit.ts';
import {
  addToRoster,
  parseRoster,
  serializeRoster,
  type RosterEntry,
} from '../../src/game/character/roster.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';
import { WORLD_LISTENERS } from '../../src/game/world/listeners.ts';

const data: GameData = { srd: loadSrd(), content: loadContent(), listeners: WORLD_LISTENERS };

/** A complete Goblin Raider Warrior. */
const raider = (): Choices => ({
  ...emptyChoices(),
  people: 'goblin',
  array: { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 },
  background: { id: 'raider', choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] } },
  classId: 'full-warrior',
  foci: [null, null, { id: 'alert' }, { id: 'armsmaster' }, { id: 'lucky' }],
  gear: { mode: 'package', packageId: 'shield-wall' },
  freeSkill: 'notice',
  name: 'Snag',
  goal: 'Outlive the war-band',
});

/** Builds the choices with this HP die roll and id. */
function build(choices: Choices, hpRoll = 4, id = 0xabc): Character {
  const result = finishCharacter(choices, data, scriptedRng([hpRoll, id, id]));
  if (!result.ok) throw new Error(result.errors.join('; '));
  return result.character;
}

/** A roster holding Snag, made in the builder. */
function roster(): RosterEntry[] {
  return addToRoster([], build(raider()), raider());
}

describe('opening a saved character again', () => {
  it('opens a builder-made character with its own picks, after storage and the importer too', () => {
    const [snag] = roster() as [RosterEntry];
    const plan = { kind: 'wizard', choices: raider(), recovered: null };
    expect(editPlan(snag, data)).toEqual(plan);
    const stored = parseRoster(serializeRoster([snag]), data).entries[0] as RosterEntry;
    expect(editPlan(stored, data)).toEqual(plan);
  });

  it('recovers what it can when the picks are missing, stale, or name content that is gone', () => {
    const [snag] = roster() as [RosterEntry];
    const choices = recoverChoices(snag.character);
    const bare = { id: snag.id, defaultAction: snag.defaultAction, character: snag.character };
    expect(editPlan(bare, data)).toEqual({ kind: 'wizard', choices, recovered: 'missing' });
    expect(editPlan({ ...snag, character: { ...snag.character, crowns: 99 } }, data)).toMatchObject(
      { recovered: 'stale' },
    );
    expect(editPlan({ ...snag, choices: { ...raider(), people: 'gone' } }, data)).toEqual({
      kind: 'wizard',
      choices,
      recovered: 'stale',
    });
  });

  it('only renames a character who has gained XP or levels', () => {
    const [snag] = roster() as [RosterEntry];
    expect(editPlan({ ...snag, character: { ...snag.character, xp: 0.5 } }, data)).toEqual({
      kind: 'details',
    });
    const levels = { 'full-warrior': 2 };
    const c = { ...snag.character, classes: { ...snag.character.classes, levels } };
    expect(editPlan({ ...snag, character: c }, data)).toEqual({ kind: 'details' });
  });

  it('recovers people, attributes, background, class, name, and goal from the sheet', () => {
    const snag = build(raider());
    const choices = recoverChoices(snag);
    expect(choices).toMatchObject({
      people: 'goblin',
      lineage: null,
      array: raider().array,
      attributeMethod: { kind: 'array' },
      background: { id: 'raider', choice: { mode: 'pick', picks: [] } },
      classId: 'full-warrior',
      foci: [],
      gear: null,
      name: 'Snag',
      goal: 'Outlive the war-band',
    });
    const ev = evaluateChoices(choices, data);
    expect([ev.steps.people, ev.steps.attributes, ev.steps.class]).toEqual(
      Array(3).fill({ state: 'ok' }),
    );
    expect(ev.steps.background.state).not.toBe('ok');
    // Scores off the standard array are kept as named scores.
    const rolled = { ...snag.attributes.base, str: 17 };
    const odd = recoverChoices({ ...snag, attributes: { ...snag.attributes, base: rolled } });
    expect(odd.attributeMethod).toEqual({ kind: 'manual', rerolls: FREE_REROLLS + 1 });
    expect(evaluateChoices(odd, data).steps.attributes).toEqual({ state: 'ok' });
    const wolf = { name: 'Wolf', humanoid: false, arts: [] };
    expect(recoverChoices({ ...snag, forms: [wolf] }).forms).toEqual([wolf]);
  });
});

describe('saving an edited character', () => {
  it('matches names ignoring case and spaces at the ends', () => {
    expect(sameName(' snag ', 'Snag')).toBe(true);
    expect(sameName('Snag', 'Snagg')).toBe(false);
  });

  it('adds a new character with its picks when there is no original', () => {
    const entries = saveBuilt(roster(), build(raider(), 2, 0xdef), raider());
    expect(entries.map((e) => e.id)).toEqual(['snag', 'snag-2']);
    expect(entries[1]?.choices).toEqual(raider());
  });

  it('overwrites the original under the same name, keeping its id and HP roll', () => {
    const entries = roster();
    const original = entries[0] as RosterEntry;
    const goal = 'Rule the warren';
    const picks = { ...raider(), name: 'SNAG', goal };
    const saved = saveBuilt(entries, build(picks, 1, 0xdef), picks, original);
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ id: 'snag', choices: picks });
    expect(saved[0]?.character).toMatchObject({
      id: original.character.id,
      name: 'SNAG',
      goal,
      hp: original.character.hp,
    });
    // A new Constitution rolls HP anew.
    const tough = { ...raider(), array: { str: 11, dex: 12, con: 14, int: 10, wis: 9, cha: 7 } };
    const rerolled = saveBuilt(entries, build(tough, 1, 0xdef), tough, original)[0]?.character;
    expect(rerolled?.hp).not.toEqual(original.character.hp);
    expect(rerolled?.id).toBe(original.character.id);
    // So does a change of foci.
    const hardy = {
      ...raider(),
      foci: [null, null, { id: 'alert' }, { id: 'armsmaster' }, { id: 'die-hard' }],
    };
    expect(asEdit(original, build(hardy, 1, 0xdef)).hp).not.toEqual(original.character.hp);
    const developed = {
      ...raider(),
      foci: [
        null,
        null,
        { id: 'alert' },
        { id: 'armsmaster' },
        { id: 'developed-attribute', attribute: 'con' as const },
      ],
    };
    expect(asEdit(original, build(developed, 1, 0xdef)).hp).not.toEqual(original.character.hp);
    // And a change of class; a Constitution change that keeps the modifier keeps HP.
    const built = build(raider(), 1, 0xdef);
    const expert = { ...built, classes: { current: 'full-expert', levels: { 'full-expert': 1 } } };
    expect(asEdit(original, expert).hp).toEqual(built.hp);
    const steady = { ...raider(), array: { str: 14, dex: 11, con: 12, int: 10, wis: 9, cha: 7 } };
    expect(asEdit(original, build(steady, 1, 0xdef)).hp).toEqual(original.character.hp);
  });

  it('shows a build as it will save: the original under its name, else as it is', () => {
    const entries = roster();
    const original = entries[0] as RosterEntry;
    const built = build({ ...raider(), goal: 'Eat well' }, 1, 0xdef);
    expect(asEdit(original, built)).toEqual({
      ...built,
      id: original.character.id,
      hp: original.character.hp,
    });
    const grit = build({ ...raider(), name: 'Grit' }, 1, 0xdef);
    expect(asEdit(original, grit)).toBe(grit);
    expect(asEdit(undefined, built)).toBe(built);
  });

  it('adds the edit as a new character if the original was deleted meanwhile', () => {
    const original = roster()[0] as RosterEntry;
    const saved = saveBuilt([], build(raider(), 1, 0xdef), raider(), original);
    expect(saved.map((e) => [e.id, e.character.id])).toEqual([['snag', original.character.id]]);
    const renamed = saveDetails([], original, { name: 'Snag', goal: '' }, scriptedRng([]));
    expect(renamed.ok && renamed.entries.map((e) => e.id)).toEqual(['snag']);
  });

  it('gives an imported character a fresh id if the roster already holds theirs', () => {
    const entries = roster();
    const snag = (entries[0] as RosterEntry).character;
    const again = importToRoster(entries, snag, scriptedRng([0x1, 0x2]));
    expect(again.map((e) => [e.id, e.character.id])).toEqual([
      ['snag', snag.id],
      ['snag-2', 'char-0000000100000002'],
    ]);
    const grit = { ...snag, id: 'char-00000000000000ff', name: 'Grit' };
    expect(importToRoster(entries, grit, scriptedRng([])).at(-1)?.character).toBe(grit);
  });

  it('adds a new character under a new name and leaves the original alone', () => {
    const entries = roster();
    const picks = { ...raider(), name: 'Grit' };
    const saved = saveBuilt(entries, build(picks, 4, 0xdef), picks, entries[0]);
    expect(saved.map((e) => [e.id, e.character.name])).toEqual([
      ['snag', 'Snag'],
      ['grit', 'Grit'],
    ]);
    expect(saved[1]?.character.id).not.toBe(saved[0]?.character.id);
  });

  it('renames over the original, or copies under a new name with a new id', () => {
    const entries = roster();
    const original = entries[0] as RosterEntry;
    const rng = scriptedRng([0x123, 0x456]);
    const same = saveDetails(entries, original, { name: 'snag', goal: 'Eat well' }, rng);
    if (!same.ok) throw new Error(same.reason);
    expect(same.entries).toEqual([
      {
        id: 'snag',
        defaultAction: 'auto',
        character: { ...original.character, name: 'snag', goal: 'Eat well' },
      },
    ]);
    const copy = saveDetails(entries, original, { name: 'Grit', goal: '' }, rng);
    if (!copy.ok) throw new Error(copy.reason);
    expect(copy.entries.map((e) => [e.id, e.character.name, e.character.id])).toEqual([
      ['snag', 'Snag', original.character.id],
      ['grit', 'Grit', 'char-0000012300000456'],
    ]);
  });

  it('leaves the other characters alone when overwriting one', () => {
    const grit = build({ ...raider(), name: 'Grit' }, 2, 0x123);
    const entries = addToRoster(roster(), grit);
    const original = entries[0] as RosterEntry;
    const built = saveBuilt(entries, build(raider(), 1, 0xdef), raider(), original);
    expect(built[1]).toBe(entries[1]);
    const renamed = saveDetails(entries, original, { name: 'Snag', goal: '' }, scriptedRng([]));
    expect(renamed.ok && renamed.entries[1]).toBe(entries[1]);
  });

  it('refuses an empty or overlong name and an overlong goal', () => {
    const entries = roster();
    const original = entries[0] as RosterEntry;
    const save = (name: string, goal = '') =>
      saveDetails(entries, original, { name, goal }, scriptedRng([]));
    expect(save('  ')).toEqual({ ok: false, reason: 'A character needs a name.' });
    expect(save('x'.repeat(61))).toEqual({ ok: false, reason: 'Names run to 60 letters.' });
    expect(save('Snag', 'x'.repeat(201))).toEqual({
      ok: false,
      reason: 'Goals run to 200 letters.',
    });
  });
});

describe('stored picks', () => {
  it('round-trip through storage text, and malformed ones are dropped', () => {
    const entries = roster();
    expect(parseRoster(serializeRoster(entries), data).entries[0]?.choices).toEqual(raider());
    const broken = [{ ...entries[0], choices: { ...raider(), classSkills: 'x' } }] as unknown;
    const loaded = parseRoster(serializeRoster(broken as RosterEntry[]), data);
    expect(loaded.errors).toEqual([]);
    expect(loaded.entries[0]).not.toHaveProperty('choices');
  });
});
