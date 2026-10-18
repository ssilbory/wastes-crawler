import { describe, expect, it } from 'vitest';
import { craftingReferenceErrors } from '../../../src/data/crafting-check.ts';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { brokenEntry, upgrade } from '../../../src/game/character/upgrades.ts';
import { emit } from '../../../src/game/world/bus.ts';
import {
  addComponents,
  componentDrops,
  componentName,
  pickComponents,
  removeComponents,
} from '../../../src/game/world/components.ts';
import { campProject, craftShift, workOn } from '../../../src/game/world/crafting.ts';
import { capacity, maintain, upkeepNeed } from '../../../src/game/world/maintenance.ts';
import {
  canMod,
  craftLevel,
  modMisfit,
  modOf,
  startMod,
  startStrip,
} from '../../../src/game/world/mods.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { workDay } from '../../../src/game/world/workshop.ts';
import { projectText } from '../../../src/render/crafting-view.ts';
import { entryText } from '../../../src/render/town-view.ts';
import { data, encounter, member, world } from './helpers.ts';

/** The starters in Rubblegate, rich in loot dice and components. */
function stocked(): World {
  const w = world();
  w.purse = 1000;
  w.loot = [{ count: 40, sides: 6 }];
  w.components = { 'cold-iron': 2, 'ooze-essence': 1, 'grave-garnet': 1 };
  return w;
}
const fizz = (w: World) => member(w, 'Fizzwick');
const snag = (w: World) => member(w, 'Snag');
/** Snag's light spear: the first line of the pack. */
const SPEAR = 0;
const spear = (w: World) => snag(w).character.inventory[SPEAR] as InventoryEntry;
const withSkills = (m: Member, skills: Record<string, number>, foci = m.character.foci) => {
  m.character = { ...m.character, skills, foci };
};
const withTools = (m: Member) => {
  const tools = {
    id: data.content.craftingRules.tools.id,
    quantity: 1,
    location: 'stowed' as const,
  };
  m.character = { ...m.character, inventory: [...m.character.inventory, tools] };
};
const finish = (w: World) => {
  while (w.projects.length > 0) workOn(w, data, w.projects[0] as World['projects'][0]);
};

describe('who builds mods (SRD 2.8.0)', () => {
  it('counts the Artisan focus one Craft level higher, up to 5', () => {
    const w = world();
    expect(craftLevel(fizz(w))).toBe(1);
    expect(craftLevel(snag(w))).toBeNull();
    withSkills(fizz(w), {});
    expect(craftLevel(fizz(w))).toBe(1);
    withSkills(fizz(w), { craft: 4 });
    expect(craftLevel(fizz(w))).toBe(5);
    withSkills(fizz(w), { craft: 2 }, []);
    expect(craftLevel(fizz(w))).toBe(2);
  });

  it('takes an Expert or Partial Expert with Craft-1, or the Artisan focus', () => {
    const w = world();
    expect(canMod(fizz(w))).toBe(true);
    expect(canMod(snag(w))).toBe(false);
    const s = snag(w);
    s.character = {
      ...s.character,
      skills: { craft: 1 },
      classes: { current: 'full-expert', levels: { 'full-expert': 1 } },
    };
    expect(canMod(s)).toBe(true);
    withSkills(s, { craft: 0 });
    expect(canMod(s)).toBe(false);
    withSkills(s, {});
    expect(canMod(s)).toBe(false);
    withSkills(fizz(w), { craft: 3 }, []);
    expect(canMod(fizz(w))).toBe(false);
  });
});

describe('building mods (SRD 2.8.2)', () => {
  it('fits mods to the right items', () => {
    const w = world();
    const line = (id: string, extra: Partial<InventoryEntry> = {}): InventoryEntry => ({
      id,
      quantity: 1,
      location: 'stowed',
      ...extra,
    });
    expect(modMisfit(data, line('spear-light'), modOf(data, 'omened-aim'))).toBeNull();
    expect(modMisfit(data, line('axe-war'), modOf(data, 'omened-aim'))).toBe(
      'Omened Aim needs a ranged or thrown weapon.',
    );
    expect(modMisfit(data, line('large-shield'), modOf(data, 'customized'))).toBe(
      "Customized doesn't fit a Large Shield.",
    );
    expect(modMisfit(data, line('crowbar'), modOf(data, 'customized'))).toContain("doesn't fit");
    expect(modMisfit(data, line('linothorax'), modOf(data, 'razor-edge'))).toContain("doesn't fit");
    expect(
      modMisfit(data, line('dagger', { quality: 'jury-rigged' }), modOf(data, 'customized')),
    ).toBe('Jury-rigged gear can’t be modded.');
    const done = line('dagger', { mods: [{ id: 'customized', components: [] }] });
    expect(modMisfit(data, done, modOf(data, 'customized'))).toBe('It already has Customized.');
    expect(() => modOf(data, 'laser')).toThrow('unknown mod laser');
    expect(w.members).toHaveLength(4);
  });

  it('refuses without the skill, the time, the dice, or the parts', () => {
    const w = stocked();
    expect(startMod(w, data, 'm-0', 'm-0', SPEAR, 'customized')).toEqual({
      ok: false,
      reason: "Snag can't build mods.",
    });
    expect(startMod(w, data, 'm-3', 'm-0', SPEAR, 'razor-edge')).toEqual({
      ok: false,
      reason: 'Razor Edge needs Craft-2.',
    });
    expect(startMod(w, data, 'm-3', 'm-0', 1, 'customized')).toEqual({
      ok: false,
      reason: "Customized doesn't fit a Large Shield.",
    });
    w.loot = [{ count: 5, sides: 6 }];
    w.purse = 5;
    expect(startMod(w, data, 'm-3', 'm-0', SPEAR, 'customized')).toEqual({
      ok: false,
      reason: 'Customized takes 6d6 in loot dice; the 1 short cost 6 crowns.',
    });
    expect(w.loot).toEqual([{ count: 5, sides: 6 }]);
    withSkills(fizz(w), { craft: 3 });
    w.loot = [{ count: 40, sides: 6 }];
    w.components = {};
    expect(startMod(w, data, 'm-3', 'm-0', SPEAR, 'thirsting-blade')).toEqual({
      ok: false,
      reason: 'Thirsting Blade needs 1 essence and 1 gem.',
    });
    expect(() => startMod(w, data, 'm-9', 'm-0', SPEAR, 'customized')).toThrow('no such');
    w.position = { col: 17, row: 4 };
    expect(startMod(w, data, 'm-3', 'm-0', SPEAR, 'customized')).toEqual({
      ok: false,
      reason: 'Grimcairn has no workshop.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(startMod(w, data, 'm-3', 'm-0', SPEAR, 'customized')).toMatchObject({ ok: false });
  });

  it('pays dice and components, marks the item, and builds at the workshop', () => {
    const w = stocked();
    withSkills(fizz(w), { craft: 3 });
    expect(startMod(w, data, 'm-3', 'm-0', SPEAR, 'thirsting-blade')).toEqual({ ok: true });
    expect(w.loot).toEqual([{ count: 34, sides: 6 }]);
    expect(w.components).toEqual({ 'cold-iron': 2 });
    expect(spear(w).serial).toBe('s1');
    // Three weeks, halved working full time: 11 days.
    expect(w.projects[0]).toMatchObject({ kind: 'mod', daysLeft: 11, target: 's1' });
    expect(projectText(w, data, w.projects[0] as World['projects'][0])).toBe(
      'Fizzwick: Thirsting Blade on the Spear, Light, 11 days left',
    );
    expect(w.log.at(-1)).toContain(
      "Fizzwick starts building Thirsting Blade onto Snag's Spear, Light: 11 days of work.",
    );
    expect(startMod(w, data, 'm-3', 'm-0', SPEAR, 'customized')).toEqual({
      ok: false,
      reason: 'Fizzwick is already making something.',
    });
    // In camp a made camp alone does nothing; a crafter's shift with tools works half a day.
    w.position = { col: 4, row: 8 };
    w.camp = 'made';
    emit(w, data, { kind: 'day-passed' });
    expect(w.projects[0]?.daysLeft).toBe(11);
    withTools(fizz(w));
    craftShift(w, data, fizz(w));
    craftShift(w, data, fizz(w));
    expect(w.projects[0]?.daysLeft).toBe(10);
    expect(w.log.at(-1)).toContain('Fizzwick works on Thirsting Blade for the Spear, Light.');
    w.position = { col: 3, row: 8 };
    for (let i = 0; i < 10; i++) workDay(w, data);
    expect(w.projects).toEqual([]);
    expect(spear(w).mods).toEqual([
      { id: 'thirsting-blade', components: ['ooze-essence', 'grave-garnet'] },
    ]);
    expect(w.log.join('\n')).toContain('Fizzwick finishes Thirsting Blade on the Spear, Light.');
  });

  it('pays dice short in crowns at their highest face, or the whole cost in crowns', () => {
    const w = stocked();
    w.loot = [
      { count: 4, sides: 6 },
      { count: 3, sides: 4 },
    ];
    w.purse = 100;
    expect(startMod(w, data, 'm-3', 'm-0', SPEAR, 'customized')).toEqual({ ok: true });
    expect(w.loot).toEqual([{ count: 3, sides: 4 }]);
    expect(w.purse).toBe(88);
    expect(w.log.at(-1)).toContain("onto Snag's Spear, Light, 12 crowns paid for dice: 4 days");
    const all = stocked();
    expect(startMod(all, data, 'm-3', 'm-0', SPEAR, 'customized', 'crowns')).toEqual({ ok: true });
    expect(all.loot).toEqual([{ count: 40, sides: 6 }]);
    expect(all.purse).toBe(964);
  });

  it('halves the time again with a Craft assistant, and splits a stack', () => {
    const w = stocked();
    withSkills(snag(w), { craft: 0 });
    const g = member(w, 'Grukk');
    g.character = {
      ...g.character,
      inventory: [{ id: 'dagger', quantity: 3, location: 'readied' }, ...g.character.inventory],
    };
    expect(startMod(w, data, 'm-3', 'm-1', 0, 'customized')).toEqual({ ok: true });
    expect(w.projects[0]?.daysLeft).toBe(2);
    expect(g.character.inventory.slice(0, 2)).toEqual([
      { id: 'dagger', quantity: 2, location: 'readied' },
      { id: 'dagger', quantity: 1, location: 'readied', serial: 's1' },
    ]);
  });

  it('makes the creator’s first mod on a mastercrafted item free of upkeep', () => {
    const w = stocked();
    const f = fizz(w);
    const master: InventoryEntry = {
      id: 'dagger',
      quantity: 1,
      location: 'readied',
      quality: 'mastercrafted',
      maker: f.character.id,
      serial: 's7',
    };
    f.character = { ...f.character, inventory: [master] };
    startMod(w, data, 'm-3', 'm-3', 0, 'customized');
    finish(w);
    expect(f.character.inventory[0]?.mods).toEqual([
      { id: 'customized', components: [], free: true },
    ]);
    // Craft-1 and the Artisan focus make Craft-2 for mods.
    withSkills(f, { craft: 1 });
    expect(startMod(w, data, 'm-3', 'm-3', 0, 'omened-aim')).toEqual({ ok: true });
    finish(w);
    expect(f.character.inventory[0]?.mods?.[1]).toEqual({ id: 'omened-aim', components: [] });
  });

  it('numbers serials past those in use', () => {
    const w = stocked();
    const s = snag(w);
    s.character = {
      ...s.character,
      inventory: [
        { ...spear(w), serial: 's4' },
        { id: 'dagger', quantity: 1, location: 'readied' },
      ],
    };
    startMod(w, data, 'm-3', 'm-0', 1, 'customized');
    expect(s.character.inventory[1]?.serial).toBe('s5');
  });

  it('strips nothing if the mod is already gone', () => {
    const w = stocked();
    const s = snag(w);
    s.character = {
      ...s.character,
      inventory: [{ ...spear(w), mods: [{ id: 'customized', components: [] }] }],
    };
    startStrip(w, data, 'm-3', 'm-0', SPEAR, 'customized');
    s.character = { ...s.character, inventory: [{ ...spear(w), mods: [] }] };
    finish(w);
    expect(spear(w).mods).toBeUndefined();
    expect(w.components).toEqual({ 'cold-iron': 2, 'ooze-essence': 1, 'grave-garnet': 1 });
  });

  it('strips only at the workshop, never in camp', () => {
    const w = stocked();
    const s = snag(w);
    s.character = {
      ...s.character,
      inventory: [{ ...spear(w), mods: [{ id: 'customized', components: [] }] }],
    };
    startStrip(w, data, 'm-3', 'm-0', SPEAR, 'customized');
    withTools(fizz(w));
    w.position = { col: 4, row: 8 };
    expect(campProject(w, data, fizz(w))).toBeNull();
    craftShift(w, data, fizz(w));
    expect(w.projects[0]?.daysLeft).toBe(1);
    expect(w.log.at(-1)).toContain('Fizzwick has nothing to work on here.');
  });

  it('loses the work if the item is gone', () => {
    const w = stocked();
    startMod(w, data, 'm-3', 'm-0', SPEAR, 'customized');
    const s = snag(w);
    s.character = { ...s.character, inventory: s.character.inventory.slice(1) };
    finish(w);
    expect(w.log.at(-1)).toContain('The Spear, Light is gone, and the work on Customized with it.');
  });

  it('strips a mod in a day, giving its components back', () => {
    const w = stocked();
    const s = snag(w);
    s.character = {
      ...s.character,
      inventory: [
        { ...spear(w), mods: [{ id: 'razor-edge', components: ['cold-iron'] }] },
        ...s.character.inventory.slice(1),
      ],
    };
    w.components = {};
    expect(startStrip(w, data, 'm-3', 'm-0', SPEAR, 'customized')).toEqual({
      ok: false,
      reason: 'It has no Customized.',
    });
    expect(startStrip(w, data, 'm-3', 'm-0', SPEAR, 'razor-edge')).toEqual({
      ok: false,
      reason: 'Razor Edge needs Craft-2.',
    });
    withSkills(fizz(w), { craft: 2 });
    expect(startStrip(w, data, 'm-3', 'm-0', SPEAR, 'razor-edge')).toEqual({ ok: true });
    expect(projectText(w, data, w.projects[0] as World['projects'][0])).toBe(
      'Fizzwick: stripping Razor Edge off the Spear, Light, 1 day left',
    );
    finish(w);
    expect(spear(w).mods).toBeUndefined();
    expect(w.components).toEqual({ 'cold-iron': 1 });
    expect(w.log.at(-1)).toContain('Fizzwick strips Razor Edge off the Spear, Light.');
    w.encounter = encounter([['thug-or-militia']]);
    expect(startStrip(w, data, 'm-3', 'm-0', SPEAR, 'razor-edge')).toMatchObject({ ok: false });
  });
});

describe('what mods do on the sheet (SRD 2.8.4)', () => {
  const line = (extra: Partial<InventoryEntry>): InventoryEntry => ({
    id: 'spear-light',
    quantity: 1,
    location: 'readied',
    ...extra,
  });
  const mods = (...ids: string[]) => ids.map((id) => ({ id, components: [] }));

  it('adds bonuses, never above +3', () => {
    expect(upgrade(data, line({ mods: mods('customized', 'razor-edge') }))).toMatchObject({
      hit: 1,
      damage: 2,
      broken: false,
    });
    const stacked = line({
      quality: 'mastercrafted',
      mods: mods('customized', 'omened-aim', 'thirsting-blade', 'razor-edge', 'razor-edge'),
    });
    expect(upgrade(data, stacked)).toMatchObject({ hit: 3, damage: 3 });
    expect(upgrade(data, line({ mods: mods('laser') })).hit).toBe(0);
  });

  it("keeps the creator's free mod working when the rest lapse", () => {
    const free = { id: 'customized', components: [], free: true };
    const due = { id: 'customized', components: [] };
    expect(upgrade(data, line({ mods: [free, due], upkeep: 1 })).hit).toBe(1);
  });

  it('stops mods after a day unmaintained, and penalizes a week', () => {
    expect(upgrade(data, line({ mods: mods('customized'), upkeep: 1 })).hit).toBe(0);
    const week = line({ mods: mods('customized'), upkeep: 7 });
    expect(brokenEntry(data, week)).toBe(true);
    expect(upgrade(data, week).hit).toBe(-2);
    expect(brokenEntry(data, line({ quality: 'jury-rigged', upkeep: 1 }))).toBe(true);
    expect(brokenEntry(data, line({ quality: 'jury-rigged' }))).toBe(false);
  });

  it('shows on the attack line, the AC, and the load', () => {
    const w = world();
    const s = snag(w);
    const sheet = () => characterSheet(s.character, data).equipment;
    const before = sheet();
    const hit = (e: ReturnType<typeof sheet>) => e.attacks.find((a) => a.id === 'spear-light');
    const inv = s.character.inventory.map((e) =>
      e.id === 'spear-light'
        ? { ...e, mods: mods('customized', 'razor-edge') }
        : e.id === 'cuirass-and-greaves'
          ? { ...e, mods: mods('customized', 'tailored-harness') }
          : e,
    );
    s.character = { ...s.character, inventory: inv };
    const after = sheet();
    expect(hit(after)?.hit).toBe((hit(before)?.hit as number) + 1);
    expect(hit(after)?.damageBonus).toBe((hit(before)?.damageBonus as number) + 2);
    expect(hit(after)?.shock?.damage).toBe((hit(before)?.shock?.damage as number) + 2);
    expect(after.armorClass).toBe(before.armorClass + 1);
    expect(after.load.readied).toBe(before.load.readied - 1);
    // Of two readied spears, the better one counts.
    s.character = {
      ...s.character,
      inventory: [
        { id: 'spear-light', quantity: 1, location: 'readied' },
        { id: 'spear-light', quantity: 1, location: 'readied', mods: mods('razor-edge') },
      ],
    };
    expect(hit(sheet())?.damageBonus).toBe((hit(before)?.damageBonus as number) + 2);
    s.character = {
      ...s.character,
      inventory: [...s.character.inventory].reverse(),
    };
    expect(hit(sheet())?.damageBonus).toBe((hit(before)?.damageBonus as number) + 2);
  });
});

describe('maintenance (SRD 2.8.3)', () => {
  const modded = (w: World, extra: Partial<InventoryEntry> = {}) => {
    const s = snag(w);
    s.character = {
      ...s.character,
      inventory: [
        { ...spear(w), mods: [{ id: 'customized', components: [] }], ...extra },
        ...s.character.inventory.slice(1),
      ],
    };
  };

  it('gives artisans Int + Con + 3 × Craft', () => {
    const w = world();
    expect(capacity(data, fizz(w))).toBe(4);
    expect(capacity(data, snag(w))).toBe(0);
    fizz(w).dead = true;
    expect(capacity(data, fizz(w))).toBe(0);
    expect(upkeepNeed(data, spear(w))).toBeNull();
    expect(upkeepNeed(data, { ...spear(w), quality: 'jury-rigged' })).toEqual({
      level: 0,
      points: 1,
    });
    expect(
      upkeepNeed(data, {
        ...spear(w),
        mods: [
          { id: 'customized', components: [], free: true },
          { id: 'razor-edge', components: [] },
        ],
      }),
    ).toEqual({ level: 2, points: 1 });
  });

  it('keeps mods working each night, in town or out without a camp', () => {
    const w = world();
    modded(w, { upkeep: 3 });
    maintain(w, data);
    expect(spear(w).upkeep).toBeUndefined();
    w.position = { col: 4, row: 8 };
    w.camp = 'none';
    emit(w, data, { kind: 'day-passed' });
    expect(spear(w).upkeep).toBeUndefined();
  });

  it('lets mods lapse with no artisan to keep them up', () => {
    const w = world();
    modded(w);
    withSkills(fizz(w), {}, []);
    maintain(w, data);
    expect(spear(w).upkeep).toBe(1);
    expect(w.log.at(-1)).toContain("Snag's Spear, Light: its mods stop working unmaintained.");
  });

  it('breaks down after a week, and needs an artisan who could build the mod', () => {
    const w = world();
    modded(w, { upkeep: 6 });
    withSkills(fizz(w), { craft: 0 }, []);
    maintain(w, data);
    expect(spear(w).upkeep).toBe(7);
    expect(w.log.at(-1)).toContain("Snag's Spear, Light is breaking down for want of maintenance.");
    expect(entryText(data, spear(w))).toBe('Spear, Light (Customized, breaking down, readied)');
    // Craft-0 still keeps jury-rigged gear going.
    const s = snag(w);
    s.character = {
      ...s.character,
      inventory: [{ id: 'dagger', quantity: 1, location: 'readied', quality: 'jury-rigged' }],
    };
    maintain(w, data);
    expect(s.character.inventory[0]?.upkeep).toBeUndefined();
  });

  it('runs out of capacity', () => {
    const w = world();
    const s = snag(w);
    const many = Array.from({ length: 5 }, () => ({
      id: 'dagger',
      quantity: 1,
      location: 'stowed' as const,
      mods: [{ id: 'customized', components: [] }],
    }));
    s.character = { ...s.character, inventory: many };
    maintain(w, data);
    expect(s.character.inventory.map((e) => e.upkeep ?? 0)).toEqual([0, 0, 0, 0, 1]);
    expect(entryText(data, s.character.inventory[4] as InventoryEntry)).toBe(
      'Dagger (Customized, unmaintained, stowed)',
    );
  });
});

describe('components', () => {
  it('drop from their monsters by chance', () => {
    const w = world([30, 51]);
    // The war-engine is drawn on the military automaton, and drops what it drops.
    componentDrops(w, data, ['automaton-humanlike', 'war-engine', 'thug-or-militia']);
    expect(w.components).toEqual({ 'cold-iron': 1 });
    expect(w.log.at(-1)).toContain('The party takes cold iron.');
    expect(componentName(data, 'cold-iron')).toBe('Cold iron');
    expect(componentName(data, 'unobtainium')).toBe('unobtainium');
  });

  it('pay for needs from the most plentiful of a type, and come back', () => {
    const w = world();
    w.components = { 'cold-iron': 2, 'beast-hide': 1 };
    expect(pickComponents(w, data, [{ type: 'metal', count: 2 }])).toEqual([
      'cold-iron',
      'cold-iron',
    ]);
    expect(pickComponents(w, data, [{ type: 'metal', count: 3 }])).toBeNull();
    removeComponents(w, ['cold-iron', 'beast-hide']);
    expect(w.components).toEqual({ 'cold-iron': 1 });
    addComponents(w, ['beast-hide']);
    expect(w.components).toEqual({ 'cold-iron': 1, 'beast-hide': 1 });
  });

  it('are checked against the monsters and mods', () => {
    const { srd, content } = data;
    expect(craftingReferenceErrors(srd, content)).toEqual([]);
    const broken = {
      ...content,
      components: [
        {
          ...(content.components[0] as (typeof content.components)[0]),
          sources: [{ monster: 'dragon', chance: 5 }],
        },
      ],
    };
    expect(craftingReferenceErrors(srd, broken)).toEqual([
      'components/beast-hide: unknown monster dragon',
      'mods/razor-edge: no component is metal',
      'mods/thirsting-blade: no component is essence',
      'mods/thirsting-blade: no component is gem',
      'craftingRules: no component is metal',
      'craftingRules: no component is essence',
      'craftingRules: no component is metal',
      'craftingRules: no component is essence',
      'craftingRules: no component is gem',
      'craftingRules: no component is metal',
      'craftingRules: no component is essence',
      'craftingRules: no component is gem',
    ]);
  });

  it('save with the world, and older saves start with none', () => {
    const w = stocked();
    startMod(w, data, 'm-3', 'm-0', SPEAR, 'customized');
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.components).toEqual(w.components);
    expect(back.ok && back.world.projects).toEqual(w.projects);
    const save = JSON.parse(serializeWorld(w));
    delete save.components;
    save.projects = [{ ...save.projects[0], kind: undefined }];
    save.schemaVersion = 11;
    const old = parseWorld(JSON.stringify(save), data);
    expect(old.ok && old.world.components).toEqual({});
    expect(old.ok && old.world.projects[0]?.kind).toBe('gear');
  });
});
