import { describe, expect, it } from 'vitest';
import { loadSrd } from '../src/data/load.ts';
import { crossReferenceErrors } from '../tools/srd-extract/validate.ts';

const srd = loadSrd();

describe('data/srd', () => {
  it('validates against the schemas with no cross-reference errors', () => {
    expect(crossReferenceErrors(srd)).toEqual([]);
  });

  it('has the expected record counts', () => {
    expect(Object.fromEntries(Object.entries(srd).map(([k, v]) => [k, v.length]))).toEqual({
      skills: 21,
      foci: 35,
      classes: 6,
      progressions: 13,
      'casting-progressions': 5,
      'weapon-traits': 12,
      weapons: 29,
      armor: 15,
      gear: 29,
      'gear-bundles': 6,
      spells: 67,
      arts: 27,
      monsters: 35,
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
    expect(srd.weapons.find((w) => w.id === 'hurlant-great')).toMatchObject({
      encumbrance: 15,
      range: { short: 600, long: 2400 },
      cost: { amount: 10000, unit: 'sp' },
    });
    expect(srd.monsters.find((m) => m.id === 'barbarian-warlord')).toMatchObject({
      ac: 16,
      armored: true,
      attackBonus: 10,
      attacks: 2,
      damage: { kind: 'weapon', bonus: 4 },
      shock: { kind: 'weapon', bonus: 4, ignoresAc: true },
    });
    expect(srd.monsters.find((m) => m.id === 'legendary-god-titan')?.shock).toEqual({
      kind: 'fixed',
      damage: 10,
      maxAc: null,
    });
    expect(srd.monsters.find((m) => m.id === 'automaton-humanlike')).toBeDefined();
    const gear = (id: string) => srd.gear.find((g) => g.id === id);
    expect(gear('candle')).toMatchObject({ encumbrance: null, weightless: true });
    expect(gear('backpack')).toMatchObject({ encumbrance: 1, freeWhenWorn: true });
    expect(gear('torch')).toMatchObject({ encumbrance: 1, bundlesOfThree: true });
    expect(srd.foci.find((f) => f.id === 'cultured')?.description).toMatch(/^Through wide travel/);
    expect(srd.foci.find((f) => f.id === 'assassin')?.description).toMatch(/^You are practiced at/);
  });

  it('records every copy of a shared progression table', () => {
    const shared = srd.progressions.find((p) => p.id === 'partial-expert-partial-warrior');
    expect(shared?.sources).toHaveLength(3);
  });
});
