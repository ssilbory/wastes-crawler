import { describe, expect, it } from 'vitest';
import { loadSrd } from '../src/data/load.ts';
import { crossReferenceErrors } from '../tools/srd-extract/validate.ts';

const srd = loadSrd();

describe('data/srd', () => {
  it('validates against the schemas with no cross-reference errors', () => {
    expect(crossReferenceErrors(srd)).toEqual([]);
  });

  it('has the expected record counts', () => {
    expect({
      skills: srd.skills.length,
      classes: srd.classes.length,
      progressions: srd.progressions.length,
      castingProgressions: srd['casting-progressions'].length,
      weaponTraits: srd['weapon-traits'].length,
      weapons: srd.weapons.length,
      armor: srd.armor.length,
    }).toEqual({
      skills: 21,
      classes: 6,
      progressions: 13,
      castingProgressions: 4,
      weaponTraits: 12,
      weapons: 29,
      armor: 15,
    });
  });

  it('matches hand-checked SRD values', () => {
    const warrior = srd.progressions.find((p) => p.id === 'full-warrior');
    expect(warrior?.levels[9]).toEqual({
      level: 10,
      hitDice: { count: 10, sides: 6, modifier: 20 },
      attackBonus: 10,
      focusPicks: [{ count: 1, category: 'any' }],
    });
    expect(srd.weapons.find((w) => w.id === 'halberd')).toMatchObject({
      damage: { count: 1, sides: 10, modifier: 0 },
      shock: { damage: 2, maxAc: 15 },
      traits: ['two-handed', 'long'],
    });
    expect(srd.armor.find((a) => a.id === 'plate-armor')).toMatchObject({ ac: 17, encumbrance: 2 });
  });

  it('records every copy of a shared progression table', () => {
    const shared = srd.progressions.find((p) => p.id === 'partial-expert-partial-warrior');
    expect(shared?.sources).toHaveLength(3);
  });
});
