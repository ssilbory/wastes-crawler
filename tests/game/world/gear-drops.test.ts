import { describe, expect, it } from 'vitest';
import { characterSheet } from '../../../src/game/character/derived.ts';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { findPeople } from '../../../src/game/character/people.ts';
import { atGuardedVault } from '../../../src/game/dungeon/ruins.ts';
import { dropGear, dropsGear } from '../../../src/game/world/gear-drops.ts';
import { memberSheet } from '../../../src/game/world/members.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { winnings } from '../../../src/game/world/winnings.ts';
import { data, member, world } from './helpers.ts';

const plains = { col: 5, row: 9 };
const WIN = { xp: 1, boss: false };
const BOSS = { xp: 2, boss: true };

/** The starters on the plains, with the RNG scripted to these faces. */
function scripted(faces: number[]): World {
  const w = world(faces);
  w.position = plains;
  return w;
}

/** Every member at this level of a warrior class, for the party level. */
function atLevel(w: World, level: number): void {
  for (const m of w.members)
    m.character = {
      ...m.character,
      classes: { current: 'full-warrior', levels: { 'full-warrior': level } },
    };
}

/** The new line a drop added to someone's pack, and who got it. */
function dropped(before: World['members'], w: World): { m: Member; entry: InventoryEntry } | null {
  for (const m of w.members) {
    const was = before.find((x) => x.id === m.id)?.character.inventory.length ?? 0;
    if (m.character.inventory.length > was)
      return { m, entry: m.character.inventory.at(-1) as InventoryEntry };
  }
  return null;
}

const snapshot = (w: World) => w.members.map((m) => ({ ...m }));

describe('which foes drop gear (docs/rules-adaptation.md, Gear drops)', () => {
  it('takes humanoids, reskins included, that drop no components', () => {
    expect(dropsGear(data, 'thug-or-militia')).toBe(true);
    expect(dropsGear(data, 'human-raider')).toBe(true);
    expect(dropsGear(data, 'lich')).toBe(true);
    // A mage drops components instead; beasts and the plant folk are no humanoids.
    expect(dropsGear(data, 'petty-mage')).toBe(false);
    expect(dropsGear(data, 'flesh-crafter')).toBe(false);
    expect(dropsGear(data, 'herd-beast')).toBe(false);
    expect(dropsGear(data, 'mushroom-warrior')).toBe(false);
    expect(dropsGear(data, 'no-such-monster')).toBe(false);
  });

  it('drops nothing, drawing no dice, for a fight worth no XP or with no such foes', () => {
    const w = scripted([]);
    expect(dropGear(w, data, ['thug-or-militia'], { xp: 0, boss: true })).toBe(0);
    expect(dropGear(w, data, ['herd-beast', 'petty-mage'], BOSS)).toBe(0);
  });

  it('drops only now and then', () => {
    const { chance, fine } = data.content.craftingRules.drops;
    const w = scripted([chance + 1, fine.chance + 1]);
    const before = snapshot(w);
    expect(dropGear(w, data, ['thug-or-militia'], WIN)).toBe(0);
    expect(dropped(before, w)).toBeNull();
  });
});

describe('what drops', () => {
  it('drops a low-level party the foe’s own weapon, jury-rigged', () => {
    // The chance, the foe, the tier, then weapon over armor.
    const w = scripted([1, 0, 1, 2]);
    const before = snapshot(w);
    // A quarter of the 5-crown spear's price, rounded to a tenth.
    expect(dropGear(w, data, ['thug-or-militia'], WIN)).toBe(1.3);
    const got = dropped(before, w);
    expect(got?.entry).toEqual({
      id: 'spear-light',
      quantity: 1,
      location: 'stowed',
      quality: 'jury-rigged',
    });
    expect(w.log.at(-1)).toContain(
      `${got?.m.character.name} takes the Spear, Light (jury-rigged) from the fallen.`,
    );
  });

  it('drops the armor an armored foe wears, sized for the one who takes it', () => {
    const w = scripted([1, 0, 1, 1]);
    const before = snapshot(w);
    dropGear(w, data, ['thug-or-militia'], WIN);
    const got = dropped(before, w);
    expect(got?.entry).toMatchObject({ id: 'linothorax', quality: 'jury-rigged' });
    const people = findPeople(data, (got?.m as Member).character.people);
    expect(got?.entry.small === true).toBe(people?.size === 'small');
  });

  it('drops normal gear at middling level', () => {
    const w = scripted([1, 0, 1, 2]);
    atLevel(w, 5);
    const before = snapshot(w);
    expect(dropGear(w, data, ['skilled-veteran'], WIN)).toBe(100);
    expect(dropped(before, w)?.entry).toEqual({
      id: 'sword-long',
      quantity: 1,
      location: 'stowed',
    });
  });

  it('keeps the costly plate for levels where mastercrafted gear drops, and then as normal', () => {
    let w = scripted([1, 0, 1, 1]);
    let before = snapshot(w);
    dropGear(w, data, ['elites-or-special-guards'], WIN);
    // AC 18 armor is plate, so a level 1 party finds the best suit short of it.
    expect(dropped(before, w)?.entry).toMatchObject({ id: 'scaled-armor', quality: 'jury-rigged' });
    w = scripted([1, 0, 2, 1]);
    atLevel(w, 9);
    before = snapshot(w);
    expect(dropGear(w, data, ['elites-or-special-guards'], WIN)).toBe(1000);
    expect(dropped(before, w)?.entry).toEqual({
      id: 'plate-armor',
      quantity: 1,
      location: 'stowed',
    });
    // The same draw for another suit is mastercrafted.
    w = scripted([1, 0, 2, 1]);
    atLevel(w, 9);
    before = snapshot(w);
    dropGear(w, data, ['skilled-veteran'], WIN);
    expect(dropped(before, w)?.entry).toMatchObject({
      id: 'cuirass-and-greaves',
      quality: 'mastercrafted',
    });
  });

  it('can drop a magic weapon or suit of armor in a boss fight', () => {
    // The magic roll, the foe, weapon over armor, then a +2.
    const w = scripted([data.content.craftingRules.drops.magicChance, 0, 2, 8]);
    const before = snapshot(w);
    // The sword's 100 crowns and a +2 commission's 800.
    expect(dropGear(w, data, ['knight-or-minor-hero'], BOSS)).toBe(900);
    expect(dropped(before, w)?.entry).toEqual({
      id: 'sword-long',
      quantity: 1,
      location: 'stowed',
      bonus: 2,
    });
    expect(w.log.at(-1)).toContain('Sword, Long +2');
  });

  it('falls back to the ordinary roll when a boss fight’s magic doesn’t come', () => {
    const w = scripted([data.content.craftingRules.drops.magicChance + 1, 1, 0, 1, 2]);
    const before = snapshot(w);
    dropGear(w, data, ['thug-or-militia'], BOSS);
    expect(dropped(before, w)?.entry).toMatchObject({ id: 'spear-light', quality: 'jury-rigged' });
  });

  it('can leave a fine weapon at any level when nothing else drops', () => {
    const { chance, fine } = data.content.craftingRules.drops;
    // The ordinary roll fails, the fine roll comes, then its make, then the foe.
    let w = scripted([chance + 1, fine.chance, 1, 0]);
    let before = snapshot(w);
    dropGear(w, data, ['thug-or-militia'], WIN);
    expect(dropped(before, w)?.entry).toEqual({
      id: 'spear-light',
      quantity: 1,
      location: 'stowed',
      quality: 'mastercrafted',
    });
    // A +2 is of normal make, and always a weapon even from an armored foe.
    w = scripted([chance + 1, 1, 10, 0]);
    before = snapshot(w);
    dropGear(w, data, ['skilled-veteran'], WIN);
    expect(dropped(before, w)?.entry).toEqual({
      id: 'sword-long',
      quantity: 1,
      location: 'stowed',
      bonus: 2,
    });
    expect(w.log.at(-1)).toContain('Sword, Long +2');
  });

  it('rolls no fine weapon when the ordinary drop or boss magic comes', () => {
    // Boss magic, foe, weapon, +1: no fine roll is drawn between them.
    const w = scripted([1, 0, 2, 1]);
    dropGear(w, data, ['knight-or-minor-hero'], BOSS);
    expect(() => w.rng.int(1, 100)).toThrow('ran out of faces');
  });

  it('gives a foe with no weapon of its own any priced weapon', () => {
    const w = scripted([1, 0, 1, 0]);
    const before = snapshot(w);
    dropGear(w, data, ['lich'], WIN);
    const first = data.srd.weapons.find((x) => x.cost) as { id: string };
    expect(dropped(before, w)?.entry).toMatchObject({ id: first.id, quality: 'jury-rigged' });
  });

  it('leaves the item if the one with the most room can’t carry it', () => {
    const w = scripted([1, 0, 1, 2]);
    const snag = member(w, 'Snag');
    w.members = [snag];
    const load = memberSheet(data, snag).equipment.load;
    const str = memberSheet(data, snag).scores.str;
    const room = load.stowedLimit + Math.floor(str / 2) - load.stowed - load.excess;
    snag.character = {
      ...snag.character,
      inventory: [
        ...snag.character.inventory,
        { id: 'crowbar', quantity: room, location: 'stowed' },
      ],
    };
    const lines = snag.character.inventory.length;
    expect(dropGear(w, data, ['thug-or-militia'], WIN)).toBe(0);
    expect(snag.character.inventory).toHaveLength(lines);
    expect(w.log.at(-1)).toContain('Too laden to carry it, the party leaves behind the Spear');
  });

  it('gives nothing when no one is awake to take it', () => {
    const w = scripted([1, 0, 1, 2]);
    for (const m of w.members)
      m.character = { ...m.character, hp: { ...m.character.hp, current: 0 } };
    expect(dropGear(w, data, ['thug-or-militia'], WIN)).toBe(0);
  });
});

describe('a drop’s cost in loot dice', () => {
  it('cuts the fight’s loot dice, leaving at least three quarters', () => {
    const w = scripted([1, 0, 1, 2]);
    atLevel(w, 5);
    const foes = Array<string>(8).fill('skilled-veteran');
    // Sixteen d6s; a 100-crown long sword takes all it can: a quarter of them.
    winnings(w, data, [foes], WIN);
    expect(w.loot).toEqual([{ count: 12, sides: 6 }]);
    expect(w.log.at(-1)).toContain('The party takes 12d6 of loot.');
  });

  it('pays the full dice when nothing drops, or the fight is worth no XP', () => {
    let w = scripted([100, 100]);
    winnings(w, data, [['thug-or-militia', 'thug-or-militia']], WIN);
    expect(w.loot).toEqual([{ count: 2, sides: 6 }]);
    w = scripted([]);
    winnings(w, data, [['thug-or-militia']], { xp: 0, boss: false });
    winnings(w, data, [['thug-or-militia']]);
    expect(w.loot).toEqual([{ count: 2, sides: 6 }]);
  });
});

describe('boss fights and magic armor', () => {
  it('counts no vault outside a dungeon', () => {
    expect(atGuardedVault(world(), data)).toBe(false);
  });

  it('adds magic armor’s bonus to its AC, within the +3 cap (SRD 4.9.3, 2.8.4)', () => {
    const c = world().members[1]?.character as Member['character'];
    const ac = (extra: Partial<InventoryEntry>) =>
      characterSheet(
        {
          ...c,
          inventory: [{ id: 'mail-shirt', quantity: 1, location: 'worn', ...extra }],
        },
        data,
      ).equipment.armorClass;
    const plain = ac({});
    expect(ac({ bonus: 1 })).toBe(plain + 1);
    expect(ac({ bonus: 3, mods: [{ id: 'customized', components: [] }] })).toBe(plain + 3);
  });
});
