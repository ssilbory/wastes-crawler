import { describe, expect, it } from 'vitest';
import { loadContent } from '../../src/data/content.ts';
import { loadSrd } from '../../src/data/load.ts';
import type { ItemLocation, People } from '../../src/data/schemas/index.ts';
import type { GameData } from '../../src/game/character/context.ts';
import {
  activeEffects,
  inventoryErrors,
  loadoutArmorClass,
  loadoutAttacks,
  loadoutLoad,
  type Loadout,
} from '../../src/game/character/equipment.ts';
import type { HeldFocus } from '../../src/game/character/foci.ts';
import { evaluateGear, rollStartingCrowns } from '../../src/game/character/gear.ts';
import {
  buyable,
  entryPrice,
  findItem,
  tenths,
  type CatalogItem,
  type InventoryEntry,
} from '../../src/game/character/items.ts';
import { findPeople } from '../../src/game/character/people.ts';
import { scriptedRng } from '../helpers/scripted-rng.ts';

const data: GameData = { srd: loadSrd(), content: loadContent() };
const people = (id: string) => findPeople(data, id) as People;
const item = (id: string) => findItem(data, id) as CatalogItem;
const I = (
  id: string,
  location: ItemLocation = 'readied',
  extra: Partial<InventoryEntry> = {},
): InventoryEntry => ({ id, quantity: 1, location, ...extra });
const f = (id: string, level = 1): HeldFocus => ({ id, level });

/** A level-1 character with no attack bonus, skills, or foci unless a test adds them. */
function loadout(overrides: Partial<Loadout>): Loadout {
  return {
    entries: [],
    people: people('orc'),
    scores: { str: 14, dex: 12, con: 11, int: 10, wis: 9, cha: 7 },
    bonuses: {},
    skills: {},
    foci: [],
    level: 1,
    attackBonus: 0,
    ...overrides,
  };
}
const ac = (o: Partial<Loadout>) => loadoutArmorClass(data, loadout(o));
const attack = (o: Partial<Loadout>, id: string, mode = 'melee') =>
  loadoutAttacks(data, loadout(o)).find((a) => a.id === id && a.mode === mode);

describe('armor class fixtures', () => {
  it('averages a centaur’s armor and barding, rounding down (docs/rules-adaptation.md)', () => {
    const centaur = people('centaur');
    const cuirass = I('cuirass-and-greaves', 'worn');
    const barding = I('cuirass-and-greaves', 'worn', { barding: true });
    expect(ac({ people: centaur, entries: [cuirass, barding] })).toBe(15);
    // Unbarded counts as AC 10: (15 + 10) / 2 = 12.5, so 12.
    expect(ac({ people: centaur, entries: [cuirass] })).toBe(12);
    // Scaled 16 with mail shirt barding 14 averages to 15.
    const scaled = I('scaled-armor', 'worn');
    const mail = I('mail-shirt', 'worn', { barding: true });
    expect(ac({ people: centaur, entries: [scaled, mail] })).toBe(15);
    // A shield applies after the average: max(15, 12 + 2) = 15.
    expect(ac({ people: centaur, entries: [cuirass, I('large-shield', 'worn')] })).toBe(15);
    expect(ac({ people: centaur })).toBe(10);
  });

  it('uses the better of the shield base or armor plus the bonus, then Dex', () => {
    const dex14 = { str: 14, dex: 14, con: 11, int: 10, wis: 9, cha: 7 };
    expect(ac({ entries: [I('small-shield', 'worn')] })).toBe(13);
    // Mail shirt 14 + small shield: max(13, 15) = 15; Dex +1 makes 16.
    expect(
      ac({ scores: dex14, entries: [I('mail-shirt', 'worn'), I('small-shield', 'worn')] }),
    ).toBe(16);
    // Linothorax 13 + large shield: max(15, 15) = 15.
    expect(ac({ entries: [I('linothorax', 'worn'), I('large-shield', 'worn')] })).toBe(15);
    expect(ac({ entries: [I('plate-armor', 'worn'), I('tower-shield', 'worn')] })).toBe(19);
    // Stowed armor doesn't count.
    expect(ac({ entries: [I('plate-armor', 'stowed')] })).toBe(10);
    // Developed Attribute raises the Dex modifier: 12 is +0, boosted to +1.
    expect(ac({ bonuses: { dex: 1 } })).toBe(11);
  });

  it('gives Impervious Defense 15 plus half the level, rounded up', () => {
    const foci = [f('impervious-defense')];
    expect(ac({ foci, entries: [I('war-shirt', 'worn')] })).toBe(16);
    expect(ac({ foci, level: 3 })).toBe(17);
    // Innate 16 + small shield: max(13, 17) = 17.
    expect(ac({ foci, entries: [I('small-shield', 'worn')] })).toBe(17);
    expect(ac({ foci, entries: [I('great-armor', 'worn')] })).toBe(19);
  });
});

describe('attack fixtures (SRD 2.4.5)', () => {
  it('adds attack bonus, the better attribute, and the skill, or -2 unskilled', () => {
    const fighter = { attackBonus: 1, skills: { stab: 1 }, entries: [I('sword-long')] };
    // Str 14 (+1), Dex 12 (+0): 1 + 1 + 1 = 3; damage 1d8+1; Shock 2 + 1 = 3 against AC 13.
    expect(attack(fighter, 'sword-long')).toEqual({
      id: 'sword-long',
      name: 'Sword, Long',
      mode: 'melee',
      hit: 3,
      damage: { count: 1, sides: 8, modifier: 0 },
      damageBonus: 1,
      shock: { damage: 3, maxAc: 13 },
    });
    expect(attack({ entries: [I('sword-long')] }, 'sword-long')?.hit).toBe(-1);
    // Stowed weapons get no attack line.
    expect(attack({ entries: [I('sword-long', 'stowed')] }, 'sword-long')).toBeUndefined();
  });

  it('uses Shoot for bows, the better of Stab and Shoot when thrown, and spares the crossbow', () => {
    const dex14 = { str: 10, dex: 14, con: 11, int: 10, wis: 9, cha: 7 };
    const archer = { scores: dex14, skills: { shoot: 1 }, foci: [f('deadeye')] };
    const entries = [I('bow-small'), I('crossbow'), I('dagger')];
    // Bow: 0 + 1 + 1 = 2; Deadeye adds Shoot-1 to damage: 1d6 + 1 + 1.
    expect(attack({ ...archer, entries }, 'bow-small', 'ranged')).toMatchObject({
      hit: 2,
      damageBonus: 2,
      shock: null,
    });
    // Thrown dagger uses Shoot-1; in melee it has no Stab, so -2.
    expect(attack({ ...archer, entries }, 'dagger', 'thrown')).toMatchObject({ hit: 2 });
    expect(attack({ ...archer, entries }, 'dagger', 'melee')).toMatchObject({
      hit: -1,
      damageBonus: 1,
      shock: { damage: 2, maxAc: 15 },
    });
    // No Shoot skill: the bow takes -2, the crossbow doesn't (SRD 3.5.2).
    expect(attack({ scores: dex14, entries }, 'bow-small', 'ranged')?.hit).toBe(-1);
    expect(attack({ scores: dex14, entries }, 'crossbow', 'ranged')?.hit).toBe(1);
  });

  it('applies Armsmaster to weapons but not to unarmed attacks', () => {
    const armsmaster = { skills: { stab: 1, punch: 0 }, entries: [I('mace')] };
    // Level 1: damage and Shock add Stab-1. Mace Str +1: Shock 1 + 1 + 1 = 3 against AC 18.
    expect(attack({ ...armsmaster, foci: [f('armsmaster')] }, 'mace')).toMatchObject({
      hit: 2,
      damageBonus: 2,
      shock: { damage: 3, maxAc: 18 },
    });
    // Level 2: +1 to hit and Shock against any AC.
    expect(attack({ ...armsmaster, foci: [f('armsmaster', 2)] }, 'mace')).toMatchObject({
      hit: 3,
      shock: { damage: 3, maxAc: null },
    });
    // Without Stab, Armsmaster adds nothing to damage, and the mace takes the -2.
    expect(attack({ entries: [I('mace')], foci: [f('armsmaster')] }, 'mace')).toMatchObject({
      hit: -1,
      damageBonus: 1,
      shock: { damage: 2, maxAc: 18 },
    });
    expect(attack({ ...armsmaster, foci: [f('armsmaster', 2)] }, 'unarmed-attack')).toMatchObject({
      hit: 1,
      damageBonus: 1,
      shock: null,
    });
  });

  it('gives Unarmed Combatant bigger dice and Shock from Punch-1', () => {
    const brawler = { foci: [f('unarmed-combatant')] };
    // Punch-1, Str +1: 0 + 1 + 1 = 2; 1d8 + 1 + Punch 1; Shock 1 + 1 = 2 against AC 15.
    expect(attack({ ...brawler, skills: { punch: 1 } }, 'unarmed-attack')).toMatchObject({
      hit: 2,
      damage: { count: 1, sides: 8, modifier: 0 },
      damageBonus: 2,
      shock: { damage: 2, maxAc: 15 },
    });
    expect(attack({ ...brawler, skills: { punch: 0 } }, 'unarmed-attack')).toMatchObject({
      damage: { count: 1, sides: 6, modifier: 0 },
      shock: null,
    });
    // Without the focus, an unarmed attack does 1d2 and no Shock.
    // Unarmed Combatant without any Punch skill uses the level-0 dice and has no Shock.
    expect(attack(brawler, 'unarmed-attack')).toMatchObject({
      damage: { count: 1, sides: 6, modifier: 0 },
      damageBonus: 1,
      shock: null,
    });
    expect(attack({ skills: { punch: 0 } }, 'unarmed-attack')).toMatchObject({
      damage: { count: 1, sides: 2, modifier: 0 },
      damageBonus: 1,
    });
  });

  it('stacks Shocking Assault and War-bred on melee Shock', () => {
    const str16 = { str: 16, dex: 12, con: 11, int: 10, wis: 9, cha: 7 };
    const orc = {
      scores: str16,
      skills: { stab: 0 },
      foci: [f('shocking-assault', 2), f('war-bred')],
      entries: [I('sword-long')],
    };
    // Shock 2 + Str 1 + 2 (Shocking Assault 2) + 1 (War-bred) = 6, against any AC.
    expect(attack(orc, 'sword-long')).toMatchObject({ hit: 1, shock: { damage: 6, maxAc: null } });
    // Close Combatant level 2 also lets Shock ignore AC.
    expect(
      attack({ entries: [I('sword-long')], foci: [f('close-combatant', 2)] }, 'sword-long')?.shock,
    ).toEqual({ damage: 3, maxAc: null });
  });

  it('gives beastmen a horn attack', () => {
    // Horns: Punch-0, Str +1: 0 + 1 + 0 = 1; 1d6 + 1; Shock 1 + 1 = 2 against AC 13.
    expect(attack({ skills: { punch: 0 }, foci: [f('horned')] }, 'horns')).toMatchObject({
      name: 'Horns',
      hit: 1,
      damageBonus: 1,
      shock: { damage: 2, maxAc: 13 },
    });
  });
});

describe('encumbrance (docs/rules-adaptation.md)', () => {
  const load = (o: Partial<Loadout>) => loadoutLoad(data, loadout(o));

  it('counts SRD encumbrance markers, the N trait, and double-weight barding', () => {
    expect(load({ entries: [{ ...I('throwing-blade'), quantity: 5 }] }).readied).toBe(1);
    expect(load({ entries: [{ ...I('throwing-blade'), quantity: 6 }] }).readied).toBe(2);
    expect(load({ entries: [{ ...I('torch', 'stowed'), quantity: 4 }] }).stowed).toBe(2);
    expect(load({ entries: [I('candle', 'stowed')] }).stowed).toBe(0);
    expect(load({ entries: [I('clothes-common', 'worn')] }).readied).toBe(0);
    expect(load({ entries: [I('clothes-common', 'stowed')] }).stowed).toBe(1);
    expect(load({ entries: [I('dungeoneering-kit', 'stowed')] }).stowed).toBe(6);
    expect(load({ entries: [I('tower-shield', 'worn')] }).readied).toBe(3);
    const barding = I('cuirass-and-greaves', 'worn', { barding: true });
    expect(load({ people: people('centaur'), entries: [barding] }).readied).toBe(4);
    expect(load({ entries: [I('unarmed-attack')] }).readied).toBe(0);
    expect(load({ entries: [I('no-armor', 'worn')] }).readied).toBe(0);
    // Unknown items and foci are skipped rather than crashing a sheet.
    expect(load({ entries: [I('flying-carpet')] }).readied).toBe(0);
    expect(activeEffects(data, [f('flying')])).toEqual([]);
  });

  it('raises a centaur’s Stowed limit with Four-legged, and grades the load', () => {
    expect(load({ foci: [f('four-legged')] }).stowedLimit).toBe(21);
    const heavy = (n: number) =>
      load({ entries: [{ ...I('rations-one-week', 'stowed'), quantity: n }] });
    expect(heavy(3).state).toBe('ok');
    expect(heavy(4)).toMatchObject({ excess: 2, state: 'overloaded' });
    expect(heavy(6)).toMatchObject({ excess: 10, state: 'too-heavy' });
  });
});

describe('inventoryErrors', () => {
  const errors = (p: string, entries: InventoryEntry[]) =>
    inventoryErrors(data, entries, people(p));

  it('accepts a sized loadout', () => {
    expect(
      errors('goblin', [I('mail-shirt', 'worn', { small: true }), I('small-shield', 'worn')]),
    ).toEqual([]);
    const barding = I('linothorax', 'worn', { barding: true });
    expect(
      errors('centaur', [I('linothorax', 'worn'), barding, I('clothes-common', 'worn')]),
    ).toEqual([]);
  });

  it('reports what doesn’t fit', () => {
    expect(
      errors('orc', [
        I('flying-carpet'),
        I('dagger', 'readied', { small: true }),
        I('mail-shirt', 'stowed', { barding: true }),
        I('dagger', 'worn'),
        I('mail-shirt', 'worn', { small: true }),
        I('plate-armor', 'worn'),
        I('small-shield', 'worn'),
        I('large-shield', 'worn'),
      ]),
    ).toEqual([
      'unknown item flying-carpet',
      "Dagger can't be small or barding",
      "Orc characters can't wear barding",
      "Dagger can't be worn",
      'Mail Shirt is sized for small peoples',
      'only one suit of armor can be worn',
      'only one shield can be carried at a time',
    ]);
    expect(errors('gnome', [I('mail-shirt', 'worn')])).toEqual([
      'Gnome characters can only wear small armor',
    ]);
    const b = I('linothorax', 'worn', { barding: true });
    expect(errors('centaur', [b, b])).toEqual(['only one suit of barding can be worn']);
  });
});

describe('items', () => {
  it('prices in tenths of a crown, doubling barding (1 crown = 1 sp)', () => {
    expect(tenths({ amount: 2, unit: 'cp' })).toBe(2);
    expect(tenths({ amount: 3, unit: 'sp' })).toBe(30);
    expect(tenths({ amount: 1, unit: 'gp' })).toBe(100);
    const plate = item('plate-armor');
    expect(entryPrice(data, plate, I('plate-armor', 'worn', { barding: true }))).toBe(20000);
    expect(entryPrice(data, item('unarmed-attack'), I('unarmed-attack'))).toBe(0);
  });

  it('uses the house shields over the SRD shield rows, and sells only priced items', () => {
    expect(item('large-shield')).toMatchObject({ kind: 'shield', shield: { baseAc: 15 } });
    expect(buyable(data).some((i) => i.id === 'unarmed-attack')).toBe(false);
    expect(buyable(data).some((i) => i.id === 'wilderness-travel-gear')).toBe(true);
  });
});

describe('starting gear (SRD 1.7.7)', () => {
  const ctx = {
    people: people('goblin'),
    scores: { str: 12, dex: 14, con: 11, int: 11, wis: 9, cha: 7 },
    bonuses: {},
    skills: {},
    foci: [],
    level: 1,
    attackBonus: 0,
  };

  it('rolls 3d6 x 10 crowns', () => {
    expect(rollStartingCrowns(scriptedRng([3, 4, 5]), data)).toBe(120);
  });

  it('sizes packages for small peoples and adds barding for centaurs', () => {
    const goblin = evaluateGear(data, { mode: 'package', packageId: 'shield-wall' }, ctx);
    expect(goblin.status).toEqual({ state: 'ok' });
    expect(goblin.tenths).toBe(100);
    expect(goblin.inventory.find((e) => e.id === 'cuirass-and-greaves')).toMatchObject({
      small: true,
    });
    const centaur = evaluateGear(
      data,
      { mode: 'package', packageId: 'archer' },
      { ...ctx, people: people('centaur'), scores: { ...ctx.scores, str: 15 } },
    );
    expect(centaur.inventory.filter((e) => e.id === 'linothorax')).toEqual([
      I('linothorax', 'worn'),
      I('linothorax', 'worn', { barding: true }),
    ]);
  });

  it('checks the package, the purse, and the load', () => {
    const status = (choice: Parameters<typeof evaluateGear>[1], c = ctx) =>
      evaluateGear(data, choice, c).status;
    expect(status(null)).toEqual({ state: 'incomplete' });
    expect(status({ mode: 'package', packageId: null })).toEqual({ state: 'incomplete' });
    expect(status({ mode: 'package', packageId: 'pirate' })).toMatchObject({ state: 'error' });
    expect(status({ mode: 'shop', crowns: null, items: [] })).toEqual({ state: 'incomplete' });
    expect(status({ mode: 'shop', crowns: 50, items: [I('unarmed-attack')] })).toMatchObject({
      message: "unarmed-attack isn't for sale",
    });
    expect(status({ mode: 'shop', crowns: 50, items: [I('sword-long')] })).toMatchObject({
      message: 'that costs 100 crowns; you have 50',
    });
    expect(status({ mode: 'shop', crowns: 50, items: [I('war-shirt', 'worn')] })).toMatchObject({
      message: 'Goblin characters can only wear small armor',
    });
    const weak = { ...ctx, scores: { ...ctx.scores, str: 4 } };
    expect(status({ mode: 'package', packageId: 'shield-wall' }, weak)).toMatchObject({
      message: 'too heavy to carry (5 items over)',
    });
    const shop = evaluateGear(
      data,
      { mode: 'shop', crowns: 50, items: [I('dagger'), I('torch', 'stowed')] },
      ctx,
    );
    expect(shop).toMatchObject({ status: { state: 'ok' }, tenths: 468 });
  });
});
