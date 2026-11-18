import { describe, expect, it } from 'vitest';
import { canLevelUp } from '../../src/game/character/advance.ts';
import { autoLevel } from '../../src/game/character/auto-level.ts';
import type { Choices } from '../../src/game/character/creation.ts';
import { blankSlate, wipeClean } from '../../src/game/character/tabula-rasa.ts';
import type { Character } from '../../src/data/schemas/index.ts';
import { createRng } from '../../src/rules/rng.ts';
import { data, starter } from './combat/helpers.ts';

// Tabula Rasa (docs/rules-adaptation.md, Potions: Tabula Rasa; Sam's calls; vendor/wwn-srd/1.0
// Character Creation/ for the picks remade).

const level = (c: Character) => Object.values(c.classes.levels).reduce((a, b) => a + b, 0);

/** Snag at 4th level, hurt, with a raising's mark and Boneshaper's work on him. */
function veteran(): Character {
  const c = autoLevel(data, starter('snag'), 4, createRng('veteran'));
  return {
    ...c,
    hp: { ...c.hp, current: 3 },
    strain: { value: 2, broken: false },
    attributes: { ...c.attributes, raised: { con: -1 } },
    shaped: { by: 'char-00000000', changes: { str: 1 } },
  };
}

/** Snag's own 1st-level picks (tools/sim/make-starter-party.ts), on the blank slate. */
const snagPicks = (c: Character): Choices => ({
  ...blankSlate(c),
  background: {
    id: 'raider',
    choice: { mode: 'pick', picks: [{ index: 1 }, { index: 2 }] },
  },
  foci: [null, null, { id: 'alert' }, { id: 'armsmaster' }, { id: 'lucky' }],
  freeSkill: 'notice',
});

describe('Tabula Rasa (Sam’s calls)', () => {
  it('keeps who they are on the blank slate and leaves the 1st-level picks open', () => {
    const c = veteran();
    const slate = blankSlate(c);
    expect(slate).toMatchObject({
      people: 'goblin',
      lineage: null,
      array: c.attributes.base,
      classId: 'full-warrior',
      background: { id: 'raider', choice: { mode: 'pick', picks: [] } },
      foci: [],
      freeSkill: null,
      name: 'Snag',
    });
    expect(wipeClean(data, c, slate, createRng('t'))).toMatchObject({ ok: false });
  });

  it('takes them to 1st level with their XP, gear, crowns, strain, and marks kept', () => {
    const c = veteran();
    expect(level(c)).toBe(4);
    const r = wipeClean(data, c, snagPicks(c), createRng('t'));
    if (!r.ok) throw new Error(r.errors.join('; '));
    const fresh = r.character;
    expect(level(fresh)).toBe(1);
    expect(fresh).toMatchObject({
      id: c.id,
      name: 'Snag',
      xp: c.xp,
      crowns: c.crowns,
      inventory: c.inventory,
      strain: c.strain,
      shaped: c.shaped,
    });
    expect(fresh.attributes.raised).toEqual({ con: -1 });
    expect(fresh.attributes.advancement).toEqual({});
    expect(fresh.foci.map((f) => f.id)).toEqual(expect.arrayContaining(['alert', 'armsmaster']));
    expect(fresh.hp.current).toBeLessThanOrEqual(fresh.hp.max);
    expect(fresh.hp.current).toBe(Math.min(3, fresh.hp.max));
    // Enough XP to level back up to 4th.
    expect(canLevelUp(data, fresh)).toBe(true);
    const back = autoLevel(data, fresh, 4, createRng('back'));
    expect(level(back)).toBe(4);
    expect(back.xp).toBe(c.xp);
  });

  it('keeps no raising mark or reshaping they never had', () => {
    const c = autoLevel(data, starter('snag'), 2, createRng('plain'));
    const r = wipeClean(data, c, snagPicks(c), createRng('t'));
    if (!r.ok) throw new Error(r.errors.join('; '));
    expect(r.character.attributes.raised).toBeUndefined();
    expect(r.character.shaped).toBeUndefined();
  });

  it('refuses to change who they are: people, lineage, class, background, or scores', () => {
    const c = veteran();
    const picks = snagPicks(c);
    const changed: Partial<Choices>[] = [
      { people: 'orc' },
      { lineage: 'bison' },
      { classId: 'full-expert' },
      { background: { id: 'pit-fighter', choice: { mode: 'pick', picks: [] } } },
      { background: null },
      { array: { ...c.attributes.base, str: 3 } },
      { array: null },
    ];
    for (const patch of changed)
      expect(wipeClean(data, c, { ...picks, ...patch }, createRng('t'))).toEqual({
        ok: false,
        errors: ['Tabula Rasa keeps who they are: only the picks change.'],
      });
  });
});
