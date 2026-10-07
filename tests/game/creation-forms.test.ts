import { describe, expect, it } from 'vitest';
import type { Form } from '../../src/data/schemas/index.ts';
import {
  emptyChoices,
  evaluateChoices,
  finishCharacter,
  type Choices,
} from '../../src/game/character/creation.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';
import { data } from './combat/helpers.ts';

const WOLF: Form = { name: 'Wolf', humanoid: false, arts: ['savage-talons'] };

/** A Gnome Berserker with Savage Talons and its first form. */
const berserker = (overrides: Partial<Choices> = {}): Choices => ({
  ...emptyChoices(),
  people: 'gnome',
  array: { str: 7, dex: 12, con: 11, int: 14, wis: 10, cha: 9 },
  background: { id: 'scavenger', choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] } },
  classId: 'partial-warrior-skinshifter',
  foci: [
    null,
    { id: 'artisan' },
    { id: 'polymath', skill: 'heal' },
    { id: 'die-hard' },
    { id: 'alert' },
  ],
  magic: { arts: ['savage-talons'], known: [], prepared: [] },
  forms: [WOLF],
  freeSkill: 'know',
  gear: { mode: 'package', packageId: 'apprentice' },
  name: 'Fang',
  ...overrides,
});

describe('a Skinshifter’s first form at creation (1.5.15)', () => {
  it('keeps one form of the arts chosen, and saves it', () => {
    expect(evaluateChoices(berserker(), data).complete).toBe(true);
    const r = finishCharacter(berserker(), data, scriptedRng([4, 4, 4, 4]));
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.character.forms).toEqual([WOLF]);
    const plain = finishCharacter(berserker({ forms: [] }), data, scriptedRng([4, 4, 4, 4]));
    expect(plain.ok && plain.character.forms).toBeUndefined();
  });

  it('refuses a second form, or an art not chosen', () => {
    const magic = (o: Partial<Choices>) => evaluateChoices(berserker(o), data).steps.magic;
    expect(magic({ forms: [WOLF, { ...WOLF, name: 'Cat' }] })).toMatchObject({
      message: 'Fang can keep 1 form',
    });
    expect(magic({ name: ' ', forms: [WOLF, { ...WOLF, name: 'Cat' }] })).toMatchObject({
      message: 'This character can keep 1 form',
    });
    expect(magic({ magic: { arts: ['warform'], known: [], prepared: [] } })).toMatchObject({
      message: "Wolf: Fang can't give a form savage-talons",
    });
  });
});
