import { describe, expect, it } from 'vitest';
import { exportCharacter, importCharacter } from '../../../src/game/character/io.ts';
import {
  entryPrice,
  findItem,
  lineLabel,
  type CatalogItem,
  type InventoryEntry,
} from '../../../src/game/character/items.ts';
import { upgrade } from '../../../src/game/character/upgrades.ts';
import { collect, commission } from '../../../src/game/world/commissions.ts';
import { visitCraftsman } from '../../../src/game/world/craftsmen.ts';
import { craftShift, workOn } from '../../../src/game/world/crafting.ts';
import {
  abilitiesFor,
  abilityById,
  canForge,
  flawsLeft,
  forgeDifficulty,
  forgeTerms,
  forgeable,
  goOnFlawed,
  restartForge,
  startForge,
} from '../../../src/game/world/forging.ts';
import { checkBonus } from '../../../src/game/world/members.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { stayToWork, workDay } from '../../../src/game/world/workshop.ts';
import { projectText } from '../../../src/render/crafting-view.ts';
import { data, encounter, member, world } from './helpers.ts';

const SWORD = 'sword-long';
const skilled = (m: Member, magic = 1, craft = 1) => {
  m.character = { ...m.character, skills: { ...m.character.skills, magic, craft } };
};
const PARTS = { 'cold-iron': 3, 'ooze-essence': 3, 'grave-garnet': 3 };
type P = World['projects'][number];

function smith(faces: number[] = []): { w: World; fizz: Member } {
  const w = world(faces);
  w.purse = 5000;
  w.components = { ...PARTS };
  const fizz = member(w, 'Fizzwick');
  skilled(fizz);
  return { w, fizz };
}

describe('forging magic (docs/rules-adaptation.md, Forged magic; SRD 4.10.0)', () => {
  it('takes Magic 1 and Craft 1, or the Artisan focus', () => {
    const { w, fizz } = smith();
    expect(canForge(data, fizz)).toBe(true);
    skilled(fizz, 0, 1);
    expect(canForge(data, fizz)).toBe(false);
    // Fizzwick's Artisan focus counts Craft one higher (SRD 1.6.0), so Craft 0 is enough.
    skilled(fizz, 1, 0);
    expect(canForge(data, fizz)).toBe(fizz.character.foci.some((f) => f.id === 'artisan'));
    expect(canForge(data, member(w, 'Snag'))).toBe(false);
    // Magic alone, with no Craft and no Artisan focus, won't do.
    const lirael = member(w, 'Lirael');
    lirael.character = { ...lirael.character, skills: { ...lirael.character.skills, magic: 1 } };
    expect(canForge(data, lirael)).toBe(false);
    expect(forgeable(data)).toContain(SWORD);
    expect(forgeable(data)).toContain('mail-shirt');
  });

  it('prices the item, its bonus at the commission terms, an ability on top, against 10/12/14 +2', () => {
    expect(forgeTerms(data, SWORD, 1)).toEqual({
      crowns: 300,
      days: 30,
      components: data.content.craftingRules.magic.tiers[0]?.components,
    });
    const flaming = forgeTerms(data, SWORD, 2, 'flaming');
    expect([flaming.crowns, flaming.days, flaming.components.length]).toEqual([1300, 120, 5]);
    // Magic plate costs more than plain plate: its own 1,000 crowns plus the bonus's 200.
    expect(forgeTerms(data, 'plate-armor', 1).crowns).toBe(1200);
    expect(forgeDifficulty(data, 1)).toBe(10);
    expect(forgeDifficulty(data, 3, 'flaming', 2)).toBe(14);
    expect(abilitiesFor(data, SWORD).map((a) => a.id)).not.toContain('warding');
    expect(abilitiesFor(data, 'mail-shirt').map((a) => a.id)).toEqual(['warding']);
    expect(() => abilityById(data, 'nothing')).toThrow();
  });

  it('starts the work, paying crowns and components, and refuses what can’t be done', () => {
    const { w, fizz } = smith();
    const snag = member(w, 'Snag');
    expect(startForge(w, data, snag.id, SWORD, 1)).toEqual({
      ok: false,
      reason: 'Snag needs Magic 1 and Craft 1 to forge magic.',
    });
    expect(startForge(w, data, fizz.id, SWORD, 1, 'warding')).toEqual({
      ok: false,
      reason: "Warding doesn't fit that.",
    });
    expect(startForge(w, data, fizz.id, SWORD, 2, 'flaming')).toEqual({ ok: true });
    expect(w.purse).toBe(3700);
    expect(w.components).toEqual({ 'cold-iron': 1, 'ooze-essence': 1, 'grave-garnet': 1 });
    const p = w.projects[0] as P;
    expect(p).toEqual(
      expect.objectContaining({ kind: 'forge', bonus: 2, ability: 'flaming', days: 120 }),
    );
    expect(projectText(w, data, p)).toBe(
      'Fizzwick: forging a +2 Sword, Long (Flaming), 120 days left',
    );
    expect(startForge(w, data, fizz.id, SWORD, 1)).toEqual({
      ok: false,
      reason: 'Fizzwick is already making something.',
    });
    expect(() => startForge(w, data, 'nobody', SWORD, 1)).toThrow();
    expect(() => startForge(w, data, fizz.id, 'torch', 1)).toThrow();
    w.projects = [];
    expect(startForge(w, data, fizz.id, SWORD, 3)).toEqual({
      ok: false,
      reason: 'It needs 3 metal, 2 essence, 2 gem.',
    });
    w.purse = 0;
    expect(startForge(w, data, fizz.id, SWORD, 1).ok).toBe(false);
    w.encounter = encounter([['thug-or-militia']]);
    expect(startForge(w, data, fizz.id, SWORD, 1)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('sizes armor for the smith’s people unless asked otherwise', () => {
    const { w, fizz } = smith([6, 6]);
    // Fizzwick is a gnome: small armor by default, standard if asked.
    startForge(w, data, fizz.id, 'mail-shirt', 1, 'warding');
    expect(w.projects[0]?.small).toBe(true);
    expect(projectText(w, data, w.projects[0] as P)).toBe(
      'Fizzwick: forging a +1 Mail Shirt (Warding) (small), 60 days left',
    );
    workOn(w, data, w.projects[0] as P, 60);
    expect(fizz.character.inventory.at(-1)).toMatchObject({
      id: 'mail-shirt',
      small: true,
      bonus: 1,
      ability: 'warding',
    });
    w.components = { ...PARTS };
    startForge(w, data, fizz.id, 'mail-shirt', 1, undefined, 'standard');
    expect(w.projects[0]?.small).toBeUndefined();
  });

  it('forges the item on a success; a failure waits, kept from work, until decided', () => {
    const { w, fizz } = smith([6, 6, 1, 1]);
    startForge(w, data, fizz.id, SWORD, 1);
    workOn(w, data, w.projects[0] as P, 30);
    expect(fizz.character.inventory.at(-1)).toEqual({
      id: SWORD,
      quantity: 1,
      location: 'stowed',
      bonus: 1,
    });
    expect(w.log.at(-1)).toContain('Fizzwick forges a +1 Sword, Long.');
    startForge(w, data, fizz.id, SWORD, 1);
    workOn(w, data, w.projects[0] as P, 30);
    const p = w.projects[0] as P;
    expect(p).toEqual(expect.objectContaining({ failed: true, daysLeft: 30 }));
    expect(projectText(w, data, p)).toBe(
      'Fizzwick: forging a +1 Sword, Long, failed; start over or go on with a flaw',
    );
    // Work passes it by: no progress, no XP, no camp shift, no workshop day.
    const xp = fizz.character.xp;
    workOn(w, data, p, 5);
    expect([p.daysLeft, fizz.character.xp]).toEqual([30, xp]);
    expect(workDay(w, data)).toEqual({
      ok: false,
      reason: 'No one in the party has work under way.',
    });
    expect(() => stayToWork(w, data, fizz.id)).toThrow();
  });

  it('starts over at full price and time, the components kept and the flaws gone', () => {
    const { w, fizz } = smith([1, 1]);
    startForge(w, data, fizz.id, SWORD, 1);
    workOn(w, data, w.projects[0] as P, 30);
    // Someone else's work stays as it is.
    const other = { ...(w.projects[0] as P), crafter: 'someone-else', failed: undefined };
    w.projects = [other, ...w.projects];
    const parts = { ...w.components };
    w.purse = 0;
    expect(restartForge(w, data, fizz.id).ok).toBe(false);
    w.purse = 500;
    expect(restartForge(w, data, fizz.id)).toEqual({ ok: true });
    expect(w.purse).toBe(200);
    expect(w.components).toEqual(parts);
    expect(w.projects[1]).toEqual(expect.objectContaining({ daysLeft: 30 }));
    expect(w.projects[1]?.failed).toBeUndefined();
    expect(w.projects[0]).toBe(other);
    expect(() => restartForge(w, data, fizz.id)).toThrow();
    w.encounter = encounter([['thug-or-militia']]);
    expect(restartForge(w, data, fizz.id).ok).toBe(false);
  });

  it('goes on with a flaw in half the time at a cumulative +1, until no flaw fits', () => {
    const { w, fizz } = smith([1, 1, 0, 1, 1, 0, 1, 1, 6, 6]);
    startForge(w, data, fizz.id, SWORD, 1);
    workOn(w, data, w.projects[0] as P, 30);
    const other = { ...(w.projects[0] as P), crafter: 'someone-else' };
    w.projects = [...w.projects, other];
    const mine = () => w.projects.find((x) => x.crafter === fizz.id) as P;
    expect(flawsLeft(data, mine())).toEqual(['unbalanced', 'dull']);
    expect(goOnFlawed(w, data, fizz.id)).toEqual({ ok: true });
    const p = mine();
    expect(p).toEqual(expect.objectContaining({ flaws: ['unbalanced'], daysLeft: 15 }));
    expect(projectText(w, data, p)).toBe(
      'Fizzwick: forging a +1 Sword, Long, unbalanced, 15 days left',
    );
    workOn(w, data, p, 15);
    goOnFlawed(w, data, fizz.id);
    expect(mine().flaws).toEqual(['unbalanced', 'dull']);
    workOn(w, data, mine(), 15);
    expect(goOnFlawed(w, data, fizz.id)).toEqual({
      ok: false,
      reason: 'Another flaw would ruin it; start over or give it up.',
    });
    expect(w.projects).toContain(other);
    // Started over, the flaws are gone; a success then forges a clean blade.
    w.purse = 500;
    restartForge(w, data, fizz.id);
    workOn(w, data, mine(), 30);
    expect(fizz.character.inventory.at(-1)).toEqual({
      id: SWORD,
      quantity: 1,
      location: 'stowed',
      bonus: 1,
    });
  });

  it('forges a flawed item when a try after a flaw succeeds', () => {
    const { w, fizz } = smith([1, 1, 0, 6, 6]);
    startForge(w, data, fizz.id, SWORD, 1);
    workOn(w, data, w.projects[0] as P, 30);
    goOnFlawed(w, data, fizz.id);
    workOn(w, data, w.projects[0] as P, 15);
    expect(fizz.character.inventory.at(-1)).toMatchObject({ bonus: 1, flaws: ['unbalanced'] });
  });

  it('counts each flaw as +1 to the next roll, and another smith as +1', () => {
    const { fizz } = smith();
    const bonus = checkBonus(data, fizz, 'magic', ['int']);
    // Dice one short of 10 alone: a flaw taken, or a helper, makes the difference.
    const dice = 10 - 1 - bonus;
    const faces = [Math.ceil(dice / 2), Math.floor(dice / 2)];
    const forged = (helper: boolean) => {
      const { w, fizz: f } = smith(faces);
      if (helper) skilled(member(w, 'Lirael'));
      startForge(w, data, f.id, SWORD, 1);
      workOn(w, data, w.projects[0] as P, 30);
      return w.projects.length === 0;
    };
    expect(forged(false)).toBe(false);
    expect(forged(true)).toBe(true);
  });

  it('lets a smith who stayed behind rejoin after a failure', () => {
    const { w, fizz } = smith([1, 1]);
    startForge(w, data, fizz.id, SWORD, 1);
    const p = w.projects[0] as P;
    p.staying = true;
    workOn(w, data, p, 30);
    expect(w.projects[0]).toEqual(expect.objectContaining({ failed: true, staying: false }));
  });

  it('goes on in camp shifts with crafting tools', () => {
    const { w, fizz } = smith();
    startForge(w, data, fizz.id, SWORD, 1);
    fizz.character = {
      ...fizz.character,
      inventory: [
        ...fizz.character.inventory,
        { id: data.content.craftingRules.tools.id, quantity: 1, location: 'stowed' },
      ],
    };
    w.position = { col: 3, row: 3 };
    craftShift(w, data, fizz);
    expect(w.log.at(-1)).toContain('Fizzwick works on the +1 Sword, Long.');
  });
});

describe('commissions with an ability', () => {
  it('add the ability’s price, components, and days, and deliver it', () => {
    const w = world([1, 0, 1, 2, 2]);
    w.purse = 2000;
    w.components = { ...PARTS };
    visitCraftsman(w, data);
    expect(commission(w, data, 'dagger', 1, 'bane-of-the-dead')).toEqual({ ok: true });
    expect(w.commissions[0]).toEqual(
      expect.objectContaining({ ability: 'bane-of-the-dead', readyDay: 60 }),
    );
    expect(() => commission(w, data, 'dagger', 1, 'warding')).toThrow();
    w.day = 60;
    const st = w.craftsmen['smith-westhold'] as NonNullable<World['craftsmen'][string]>;
    w.craftsmen['smith-westhold'] = { ...st, since: 60 };
    const snag = member(w, 'Snag');
    expect(collect(w, data, 0, snag.id)).toEqual({ ok: true });
    expect(snag.character.inventory.at(-1)).toMatchObject({
      id: 'dagger',
      bonus: 1,
      ability: 'bane-of-the-dead',
    });
    expect(w.log.at(-1)).toContain('the +1 Dagger (Bane of the Dead)');
  });
});

describe('abilities and flaws on items', () => {
  const sword: InventoryEntry = {
    id: SWORD,
    quantity: 1,
    location: 'readied',
    bonus: 2,
    ability: 'flaming',
    flaws: ['dull'],
  };

  it('show in the label, count in the value, and flaws count against the item', () => {
    const item = findItem(data, SWORD) as CatalogItem;
    expect(lineLabel(data, sword)).toBe('Sword, Long +2 (Flaming, dull)');
    expect(entryPrice(data, item, sword)).toBe(
      entryPrice(data, item, { ...sword, ability: undefined }) + 4000,
    );
    expect(upgrade(data, sword)).toMatchObject({ hit: 2, damage: 1 });
    const armor = {
      id: 'mail-shirt',
      quantity: 1,
      location: 'worn' as const,
      bonus: 1,
      flaws: ['brittle', 'heavy'],
    };
    expect(upgrade(data, armor)).toMatchObject({ ac: 0, encumbrance: 1 });
  });

  it('load only where they fit, and an ability only on magic gear', () => {
    const c = member(world(), 'Snag').character;
    const load = (inventory: unknown[]) =>
      importCharacter(exportCharacter({ ...c, inventory } as typeof c), data);
    expect(load([sword]).ok).toBe(true);
    const bad = load([
      { ...sword, bonus: undefined },
      { ...sword, ability: 'warding' },
      { ...sword, ability: 'nothing' },
      { ...sword, flaws: ['brittle'] },
      { id: 'torch', quantity: 1, location: 'stowed', flaws: ['dull'] },
    ]);
    expect(bad.ok ? [] : bad.errors).toEqual([
      "inventory: sword-long can't carry the ability flaming",
      "inventory: sword-long can't carry the ability warding",
      "inventory: sword-long can't carry the ability nothing",
      "inventory: sword-long can't have the flaw brittle",
      "inventory: torch can't have the flaw dull",
    ]);
  });
});
