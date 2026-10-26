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
      classes: 13,
      progressions: 33,
      'casting-progressions': 14,
      'weapon-traits': 12,
      weapons: 29,
      armor: 15,
      gear: 29,
      'gear-bundles': 6,
      spells: 83,
      arts: 108,
      monsters: 35,
      'faction-assets': 81,
    });
  });

  it('matches hand-checked faction assets (6.8.0 to 6.10.0)', () => {
    const asset = (id: string) => srd['faction-assets'].find((a) => a.id === id);
    expect(asset('infantry')).toMatchObject({
      attribute: 'force',
      rating: 3,
      cost: 6,
      hp: 6,
      magic: 'none',
      attack: {
        kind: 'check',
        attacker: 'force',
        defender: 'force',
        damage: { count: 1, sides: 8 },
      },
      counter: { count: 1, sides: 6, modifier: 0 },
      qualities: [],
    });
    expect(asset('front-merchant')?.counter).toEqual({ count: 1, sides: 4, modifier: -1 });
    expect(asset('informers')?.attack).toEqual({
      kind: 'check',
      attacker: 'cunning',
      defender: 'cunning',
      damage: null,
    });
    expect(asset('seditionists')?.attack).toEqual({ kind: 'special' });
    expect(asset('farmers')).toMatchObject({ attack: null, qualities: ['action'] });
    expect(asset('farmers')?.text).toContain('on a 5+, they gain 1 Treasure');
    expect(asset('hired-legion')).toMatchObject({ attribute: 'wealth', rating: 8, cost: 30 });
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
    expect(srd.monsters.find((m) => m.id === 'automaton-humanlike')).toMatchObject({
      hitDice: 2,
      ac: 13,
      morale: 12,
      damage: { kind: 'weapon', bonus: 0 },
    });
    const gear = (id: string) => srd.gear.find((g) => g.id === id);
    expect(gear('candle')).toMatchObject({ encumbrance: null, weightless: true });
    expect(gear('backpack')).toMatchObject({ encumbrance: 1, freeWhenWorn: true });
    expect(gear('torch')).toMatchObject({ encumbrance: 1, bundlesOfThree: true });
    expect(srd.foci.find((f) => f.id === 'cultured')?.description).toMatch(/^Through wide travel/);
    expect(srd.foci.find((f) => f.id === 'assassin')?.description).toMatch(/^You are practiced at/);
  });

  it('reads the Invoker’s spell point tables, with the PDF’s level 1 values (page 22)', () => {
    const table = (id: string) => srd['casting-progressions'].find((p) => p.id === id);
    expect(table('full-invoker-spells')).toMatchObject({ plusInt: true });
    expect(table('full-invoker-spells')?.levels[0]).toEqual({
      level: 1,
      maxSpellLevel: 1,
      spellsCast: 0,
      spellPoints: 1,
      spellsPrepared: 2,
      arts: [],
      anyArts: 0,
    });
    expect(table('full-invoker-spells')?.levels[9]).toMatchObject({
      spellPoints: 11,
      spellsPrepared: 9,
    });
    expect(table('partial-invoker-spells')?.levels[0]).toMatchObject({
      spellPoints: 1,
      spellsPrepared: 1,
    });
    expect(table('partial-invoker-spells')?.levels[9]).toMatchObject({
      maxSpellLevel: 3,
      spellPoints: 6,
      spellsPrepared: 7,
    });
    expect(srd.progressions.find((p) => p.id === 'full-invoker')?.levels[9]).toMatchObject({
      hitDice: { count: 10, sides: 6, modifier: -10 },
      attackBonus: 2,
    });
  });

  it('reads the Skinshifter’s tables and arts, with the PDF’s casing (pages 28 and 29)', () => {
    const table = srd['casting-progressions'].find(
      (p) => p.id === 'skinshifter-arts-and-form-bonus',
    );
    expect(table?.levels.map((l) => l.formBonus)).toEqual([1, 1, 2, 2, 3, 3, 4, 4, 5, 6]);
    expect(table?.levels[0]).toMatchObject({ maxSpellLevel: 0, arts: ['change-form'], anyArts: 1 });
    expect(
      srd.progressions.find((p) => p.id === 'partial-warrior-skinshifter')?.levels[9],
    ).toMatchObject({ hitDice: { count: 10, sides: 6, modifier: 20 }, attackBonus: 7 });
    const arts = srd.arts.filter((a) => a.tradition === 'skinshifter');
    expect(arts.filter((a) => a.automatic).map((a) => a.id)).toEqual(['change-form']);
    expect(arts.find((a) => a.id === 'eyes-of-the-hawk')).toMatchObject({
      name: 'Eyes of the Hawk',
    });
    expect(arts.find((a) => a.id === 'pliant-flesh')?.text).toContain('Whenever you spend Effort');
  });

  it('reads the Beastmaster’s tables and arts, with the mirror’s defects mended', () => {
    const table = srd['casting-progressions'].find((p) => p.id === 'partial-beastmaster');
    expect(table?.levels.map((l) => l.anyArts)).toEqual([1, 1, 0, 1, 1, 1, 0, 1, 0, 1]);
    expect(table?.levels[0]).toMatchObject({ arts: ['bind-companion'] });
    expect(
      srd.progressions.find((p) => p.id === 'beastmaster-partial-expert')?.levels[9],
    ).toMatchObject({ hitDice: { count: 10, sides: 6, modifier: 0 }, attackBonus: 5 });
    const arts = srd.arts.filter((a) => a.tradition === 'beastmaster');
    expect(arts.filter((a) => a.automatic).map((a) => a.id)).toEqual(['bind-companion']);
    expect(arts).toHaveLength(12);
    expect(arts.find((a) => a.id === 'beast-ward')?.text).toContain('performs some hostile act');
    expect(arts.find((a) => a.id === 'natural-weaponry')?.text).toContain('a +2 bonus at level 6');
  });

  it('reads the Vowed’s tables, punch column, and arts, with the mirror’s defects mended', () => {
    const table = srd['casting-progressions'].find(
      (p) => p.id === 'vowed-arts-and-unarmed-abilities',
    );
    expect(table?.levels.map((l) => l.anyArts)).toEqual([1, 1, 0, 1, 1, 1, 0, 1, 0, 1]);
    expect(table?.levels[0]).toMatchObject({
      arts: ['unarmed-might', 'martial-style', 'unarmored-defense'],
      punch: {
        hit: 0,
        damage: { count: 1, sides: 6, modifier: 0 },
        shock: { damage: 1, maxAc: 15 },
      },
    });
    expect(table?.levels[9]?.punch).toEqual({
      hit: 5,
      damage: { count: 1, sides: 10, modifier: 3 },
      shock: { damage: 4, maxAc: 15 },
    });
    expect(srd.progressions.find((p) => p.id === 'partial-warrior-vowed')?.levels[9]).toMatchObject(
      { hitDice: { count: 10, sides: 6, modifier: 20 }, attackBonus: 7 },
    );
    const arts = srd.arts.filter((a) => a.tradition === 'vowed');
    expect(arts.filter((a) => a.automatic).map((a) => a.id)).toEqual([
      'martial-style',
      'unarmed-might',
      'unarmored-defense',
    ]);
    expect(arts).toHaveLength(16);
    expect(arts.find((a) => a.id === 'mob-justice')?.text).toContain('to become impervious');
  });

  it('records every copy of a shared progression table', () => {
    const shared = srd.progressions.find((p) => p.id === 'partial-expert-partial-warrior');
    expect(shared?.sources).toHaveLength(3);
  });
});
