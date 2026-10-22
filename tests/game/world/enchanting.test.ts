import { describe, expect, it } from 'vitest';
import { deviceReferenceErrors } from '../../../src/data/device-check.ts';
import { exportCharacter, importCharacter } from '../../../src/game/character/io.ts';
import {
  entryPrice,
  findItem,
  lineLabel,
  type CatalogItem,
} from '../../../src/game/character/items.ts';
import { bearsRod } from '../../../src/game/character/rods.ts';
import { burn, inDark, rodLit } from '../../../src/game/dungeon/light.ts';
import { enterDungeon } from '../../../src/game/dungeon/explore.ts';
import { craftShift, workOn } from '../../../src/game/world/crafting.ts';
import {
  canEnchant,
  deviceDifficulty,
  deviceListed,
  deviceOf,
  spellsMisfit,
  startDevice,
} from '../../../src/game/world/enchanting.ts';
import { checkBonus } from '../../../src/game/world/members.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { lightView } from '../../../src/render/dungeon-light.ts';
import { projectText } from '../../../src/render/crafting-view.ts';
import { data, encounter, member, world } from './helpers.ts';

const COFFIN = 'the-coruscating-coffin';
const WIND = 'the-wind-of-the-final-repose';
const BLIND = 'damnation-of-the-sense';
const learn = (m: Member, scribing = 1) => {
  m.character = { ...m.character, skills: { ...m.character.skills, scribing } };
};
const devices = (m: Member) =>
  m.character.inventory.filter((e) => findItem(data, e.id)?.kind === 'device');

function maker(faces: number[] = []): { w: World; fizz: Member } {
  const w = world(faces);
  w.purse = 1000;
  const fizz = member(w, 'Fizzwick');
  learn(fizz);
  return { w, fizz };
}

describe('making devices (docs/rules-adaptation.md, Devices; SRD 4.10.0)', () => {
  it('takes Magic and Scribing 1', () => {
    const { w, fizz } = maker();
    expect(canEnchant(data, fizz)).toBe(true);
    learn(fizz, 0);
    expect(canEnchant(data, fizz)).toBe(false);
    expect(canEnchant(data, member(w, 'Snag'))).toBe(false);
    // Magic without any Scribing isn't enough.
    expect(canEnchant(data, member(world(), 'Fizzwick'))).toBe(false);
    expect(() => deviceOf(data, 'nothing')).toThrow();
  });

  it('fits a wand with one low spell and a staff with two or three, five levels at most', () => {
    const wand = deviceOf(data, 'wand');
    const staff = deviceOf(data, 'arcane-staff');
    const rod = deviceOf(data, 'rod-of-light');
    expect(spellsMisfit(data, wand, [COFFIN])).toBeNull();
    expect(spellsMisfit(data, wand, [])).toBe('A wand holds one spell.');
    expect(spellsMisfit(data, wand, ['the-howl-of-light'])).toBe(
      'A wand holds a spell of level 2 or less.',
    );
    expect(spellsMisfit(data, wand, ['the-excellent-transpicuous-transformation'])).toBe(
      'Only spells cast at a foe or friend in a fight fit.',
    );
    expect(spellsMisfit(data, staff, [COFFIN, WIND])).toBeNull();
    expect(spellsMisfit(data, staff, [COFFIN, COFFIN])).toBe('Each spell goes in once.');
    expect(spellsMisfit(data, staff, [COFFIN])).toBe('A staff holds 2 to 3 spells.');
    expect(spellsMisfit(data, staff, ['deluge-of-hell', COFFIN])).toBe(
      "A staff's spells come to 5 levels at most.",
    );
    expect(spellsMisfit(data, rod, [])).toBeNull();
    expect(spellsMisfit(data, rod, [COFFIN])).toBe('A Rod of Light holds no spells.');
  });

  it('costs its price for each spell level, or a rod’s own; a wand’s difficulty adds its level', () => {
    expect(deviceListed(data, 'wand', [COFFIN])).toBe(100);
    expect(deviceListed(data, 'arcane-staff', [COFFIN, WIND, BLIND])).toBe(300);
    expect(deviceListed(data, 'rod-of-mending', [])).toBe(300);
    expect(deviceDifficulty(data, 'wand', [COFFIN])).toBe(9);
    expect(deviceDifficulty(data, 'arcane-staff', [COFFIN, WIND])).toBe(11);
    expect(deviceDifficulty(data, 'rod-of-warding', [])).toBe(10);
  });

  it('starts a month’s work, paid now, and refuses what can’t be done', () => {
    const { w, fizz } = maker();
    const snag = member(w, 'Snag');
    expect(startDevice(w, data, snag.id, 'wand', [COFFIN])).toEqual({
      ok: false,
      reason: 'Snag needs Magic and Scribing 1 to make devices.',
    });
    expect(startDevice(w, data, fizz.id, 'wand', []).ok).toBe(false);
    expect(startDevice(w, data, fizz.id, 'wand', ['conjunction-of-the-inexorable-step'])).toEqual({
      ok: false,
      reason: "Fizzwick doesn't know Conjunction of the Inexorable Step.",
    });
    expect(startDevice(w, data, fizz.id, 'arcane-staff', [COFFIN, WIND])).toEqual({ ok: true });
    expect(w.purse).toBe(800);
    const p = w.projects[0] as World['projects'][number];
    expect(p).toEqual(
      expect.objectContaining({ kind: 'device', item: 'arcane-staff', spells: [COFFIN, WIND] }),
    );
    expect(projectText(w, data, p)).toBe('Fizzwick: making a Staff, 30 days left');
    expect(startDevice(w, data, fizz.id, 'rod-of-light', [])).toEqual({
      ok: false,
      reason: 'Fizzwick is already making something.',
    });
    expect(() => startDevice(w, data, 'nobody', 'wand', [COFFIN])).toThrow();
    w.projects = [];
    w.purse = 0;
    expect(startDevice(w, data, fizz.id, 'rod-of-light', []).ok).toBe(false);
    w.encounter = encounter([['thug-or-militia']]);
    expect(startDevice(w, data, fizz.id, 'rod-of-light', [])).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('rolls Int/Magic when done: the device with its level and charges, or the materials lost', () => {
    // Success, then the wand's 2d4+2 charges (3 + 4 + 2); then a failure.
    const { w, fizz } = maker([6, 6, 3, 4, 1, 1]);
    startDevice(w, data, fizz.id, 'wand', [COFFIN]);
    workOn(w, data, w.projects[0] as World['projects'][number], 30);
    expect(devices(fizz)).toEqual([
      {
        id: 'wand',
        quantity: 1,
        location: 'stowed',
        spells: [COFFIN],
        casterLevel: 1,
        charges: 9,
      },
    ]);
    expect(w.log.at(-1)).toContain('Fizzwick finishes a Wand.');
    startDevice(w, data, fizz.id, 'rod-of-light', []);
    workOn(w, data, w.projects[0] as World['projects'][number], 30);
    expect(devices(fizz)).toHaveLength(1);
    expect(w.log.at(-1)).toContain('cracks as the binding fails');
  });

  it('makes a rod as a plain line, and helps for another maker in the party', () => {
    const { fizz } = maker();
    const dice = 10 - 1 - checkBonus(data, fizz, 'magic', ['int']);
    const faces = [Math.ceil(dice / 2), Math.floor(dice / 2)];
    const made = (help: boolean) => {
      const { w, fizz: f } = maker(faces);
      if (help) {
        const l = member(w, 'Lirael');
        l.character = { ...l.character, skills: { ...l.character.skills, magic: 0 } };
        learn(l);
      }
      startDevice(w, data, f.id, 'rod-of-mending', []);
      workOn(w, data, w.projects[0] as World['projects'][number], 30);
      return devices(f);
    };
    expect(made(false)).toEqual([]);
    expect(made(true)).toEqual([{ id: 'rod-of-mending', quantity: 1, location: 'stowed' }]);
  });
});

describe('device work in camp', () => {
  it('goes on in camp shifts with crafting tools', () => {
    const { w, fizz } = maker();
    startDevice(w, data, fizz.id, 'rod-of-light', []);
    fizz.character = {
      ...fizz.character,
      inventory: [
        ...fizz.character.inventory,
        { id: data.content.craftingRules.tools.id, quantity: 1, location: 'stowed' },
      ],
    };
    w.position = { col: 3, row: 3 };
    craftShift(w, data, fizz);
    expect(w.log.at(-1)).toContain('Fizzwick works on the Rod of Light.');
  });
});

describe('devices as items', () => {
  const staff = {
    id: 'arcane-staff',
    quantity: 1,
    location: 'readied' as const,
    spells: [COFFIN, WIND],
    casterLevel: 3,
    charges: 1,
  };

  it('are named for their spells and charges, and worth their price per spell level', () => {
    const item = findItem(data, 'arcane-staff') as CatalogItem;
    expect(lineLabel(data, staff)).toBe(
      'Staff of The Coruscating Coffin, The Wind of the Final Repose (caster level 3, 1 charge)',
    );
    expect(entryPrice(data, item, staff)).toBe(2000);
    const rod = findItem(data, 'rod-of-light') as CatalogItem;
    expect(entryPrice(data, rod, { id: 'rod-of-light', quantity: 1, location: 'stowed' })).toBe(
      3000,
    );
  });

  it('load only with fitting spells, level, and charges; rods and gear hold none', () => {
    const { w } = maker();
    const c = member(w, 'Snag').character;
    const load = (inventory: unknown[]) =>
      importCharacter(exportCharacter({ ...c, inventory } as typeof c), data);
    expect(load([staff, { id: 'rod-of-light', quantity: 1, location: 'stowed' }]).ok).toBe(true);
    const bad = load([
      { ...staff, charges: undefined },
      { ...staff, spells: undefined },
      { ...staff, spells: [COFFIN] },
      { ...staff, spells: ['nonsense', COFFIN] },
      { ...staff, spell: COFFIN },
      {
        id: 'wand',
        quantity: 1,
        location: 'stowed',
        spells: [COFFIN, WIND],
        casterLevel: 1,
        charges: 2,
      },
      { id: 'rod-of-light', quantity: 1, location: 'stowed', charges: 3 },
      { id: 'scroll', quantity: 1, location: 'stowed', spell: COFFIN, casterLevel: 1, charges: 1 },
    ]);
    expect(bad.ok ? [] : bad.errors).toEqual([
      'inventory: a staff needs its spells, caster level, and charges',
      'inventory: a staff needs its spells, caster level, and charges',
      'inventory: a staff needs its spells, caster level, and charges',
      'inventory: a staff needs its spells, caster level, and charges',
      'inventory: a staff needs its spells, caster level, and charges',
      'inventory: a wand needs its spells, caster level, and charges',
      "inventory: rod-of-light can't hold a spell",
      'inventory: a scroll needs one known spell and a caster level',
    ]);
  });

  it('are checked for clashing ids and impossible staves', () => {
    expect(deviceReferenceErrors(data.srd, data.content)).toEqual([]);
    const d = data.content.devices;
    const staffDef = deviceOf(data, 'arcane-staff');
    const broken = {
      ...data.content,
      devices: {
        ...d,
        devices: [
          { ...staffDef, id: 'staff' },
          { ...staffDef, device: { ...staffDef.device, minSpells: 4, maxSpells: 2 } },
        ],
      },
    } as typeof data.content;
    expect(deviceReferenceErrors(data.srd, broken)).toEqual([
      'devices: staff is taken',
      'devices/arcane-staff: fewer spells at most than at least',
    ]);
  });
});

describe('a Rod of Light (Devices)', () => {
  it('lights the party underground while Readied by someone awake, and nothing burns', () => {
    const w = world();
    w.position = { col: 5, row: 10 };
    enterDungeon(w, data);
    const snag = member(w, 'Snag');
    expect(rodLit(w, data)).toBe(false);
    snag.character = {
      ...snag.character,
      inventory: [
        ...snag.character.inventory,
        { id: 'rod-of-light', quantity: 1, location: 'readied' },
      ],
    };
    expect(bearsRod(data, snag.character, 'light')).toBe(true);
    expect(bearsRod(data, snag.character, 'warding')).toBe(false);
    expect(bearsRod(data, null, 'light')).toBe(false);
    expect(rodLit(w, data)).toBe(true);
    const torch = w.light.torch;
    burn(w, data);
    expect(w.light.torch).toBe(torch);
    w.light.lit = null;
    expect(inDark(w, data)).toBe(false);
    expect(lightView(w, data)?.source).toBe('faith');
    snag.character = { ...snag.character, hp: { ...snag.character.hp, current: 0 } };
    expect(rodLit(w, data)).toBe(false);
  });
});
