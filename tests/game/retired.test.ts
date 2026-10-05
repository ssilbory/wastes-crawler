import { describe, expect, it } from 'vitest';
import { takeFreeFocus } from '../../src/game/character/advance.ts';
import { exportCharacter, importCharacter } from '../../src/game/character/io.ts';
import { retire } from '../../src/game/character/retired.ts';
import { gameSkills } from '../../src/data/skills.ts';
import { data, starter } from './combat/helpers.ts';

const snag = starter('snag');

describe('skills and foci the game took away (docs/rules-adaptation.md, Skills)', () => {
  it('lists the SRD skills less the removed ones, plus Animal Ken', () => {
    const ids = gameSkills(data.srd, data.content).map((s) => s.id);
    for (const gone of ['administer', 'connect', 'ride', 'sail', 'work'])
      expect(ids).not.toContain(gone);
    expect(ids).toContain('animal-ken');
    expect(ids).toHaveLength(data.srd.skills.length - 5 + 1);
  });

  it('turns removed skills into their replacements at the higher level', () => {
    const c = retire(data, {
      ...snag,
      skills: { ride: 1, 'animal-ken': 0, work: 0, exert: 2, connect: 0 },
      advancement: { ...snag.advancement, skillCredit: { ride: 2, stab: 1 } },
    });
    expect(c.skills).toEqual({ 'animal-ken': 1, exert: 2, convince: 0 });
    expect(c.advancement.skillCredit).toEqual({ stab: 1, 'animal-ken': 2 });
    expect(c.advancement.freeFoci).toBeUndefined();
    // Credit toward the replacement keeps the larger amount.
    const both = retire(data, {
      ...snag,
      advancement: { ...snag.advancement, skillCredit: { work: 1, exert: 2 } },
    });
    expect(both.advancement.skillCredit).toEqual({ exert: 2 });
  });

  it('swaps Rider for a free focus pick per level, kept until taken', () => {
    const rider = {
      ...snag,
      foci: [...snag.foci, { id: 'rider', level: 2 }],
      advancement: { ...snag.advancement, freeFoci: 1 },
    };
    const c = retire(data, rider);
    expect(c.foci.some((f) => f.id === 'rider')).toBe(false);
    expect(c.advancement.freeFoci).toBe(3);
    // Loading a file from before version 7 does the same; a version 7 file is left as it is.
    const old = importCharacter(JSON.stringify({ ...rider, schemaVersion: 6 }), data);
    expect(old.ok && old.character.advancement.freeFoci).toBe(3);
    const current = importCharacter(exportCharacter(rider), data);
    expect(current.ok && current.character.advancement.freeFoci).toBe(1);
  });

  it('takes an owed focus pick, any category, until none are left', () => {
    expect(takeFreeFocus(data, snag, { id: 'alert' })).toEqual({
      ok: false,
      reason: 'No focus pick is owed.',
    });
    const owed = { ...snag, advancement: { ...snag.advancement, freeFoci: 2 } };
    expect(takeFreeFocus(data, owed, { id: 'rider' })).toEqual({
      ok: false,
      reason: "rider can't be picked",
    });
    const one = takeFreeFocus(data, owed, { id: 'alert' });
    expect(one.ok && one.character.advancement.freeFoci).toBe(1);
    expect(one.ok && one.character.foci.some((f) => f.id === 'alert')).toBe(true);
    if (!one.ok) return;
    const none = takeFreeFocus(data, one.character, { id: 'armsmaster' });
    expect(none.ok).toBe(true);
    expect(none.ok && 'freeFoci' in none.character.advancement).toBe(false);
  });
});
