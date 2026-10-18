import { describe, expect, it } from 'vitest';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { inventoryErrors } from '../../../src/game/character/equipment.ts';
import {
  findItem,
  type CatalogItem,
  type InventoryEntry,
} from '../../../src/game/character/items.ts';
import type { People } from '../../../src/data/schemas/index.ts';
import { findPeople } from '../../../src/game/character/people.ts';
import { emit } from '../../../src/game/world/bus.ts';
import {
  abandonProject,
  buildDays,
  buyWorkshop,
  campProject,
  canCraft,
  craftShift,
  craftable,
  hasTools,
  partsListed,
  startProject,
  tiersFor,
  workshopHere,
} from '../../../src/game/world/crafting.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { rejoin } from '../../../src/game/world/tavern.ts';
import type { World } from '../../../src/game/world/types.ts';
import { stayToWork, workDay } from '../../../src/game/world/workshop.ts';
import { projectText } from '../../../src/render/crafting-view.ts';
import { entryText } from '../../../src/render/town-view.ts';
import { data, encounter, member, world } from './helpers.ts';

type Craftable = Parameters<typeof buildDays>[1];
const item = (id: string) => findItem(data, id) as Craftable;

/** The starters in Rubblegate with 1,000 crowns. */
function rich(): World {
  const w = world();
  w.purse = 1000;
  return w;
}
const fizz = (w: World) => member(w, 'Fizzwick');
const pass = (w: World) => emit(w, data, { kind: 'day-passed' });
const TOOLS = data.content.craftingRules.tools.id;
/** Hands a member the crafting tools. */
function tools(m: World['members'][0]): void {
  m.character = {
    ...m.character,
    inventory: [...m.character.inventory, { id: TOOLS, quantity: 1, location: 'stowed' }],
  };
}
/** Camp shifts spent crafting, out in the wilds by Rubblegate. */
function shifts(w: World, m: World['members'][0], n: number): void {
  w.position = { col: 4, row: 8 };
  for (let i = 0; i < n; i++) craftShift(w, data, m);
}

describe('crafting gear (docs/rules-adaptation.md, Crafting and modifying gear)', () => {
  it('needs the Craft skill or the Artisan focus', () => {
    const w = world();
    expect(canCraft(fizz(w))).toBe(true);
    expect(canCraft(member(w, 'Snag'))).toBe(false);
    const f = fizz(w);
    f.character = { ...f.character, skills: { know: 1 } };
    expect(canCraft(f)).toBe(true);
    f.character = { ...f.character, foci: [] };
    expect(canCraft(f)).toBe(false);
  });

  it('builds anything with a market price but bundles, in tiers for weapons and armor', () => {
    const ids = craftable(data).map((i) => i.id);
    expect(ids).toContain('spear-light');
    expect(ids).toContain('large-shield');
    expect(ids).toContain('crowbar');
    expect(ids).not.toContain('club');
    expect(ids).not.toContain('no-armor');
    expect(ids).not.toContain('dungeoneering-kit');
    expect(tiersFor(item('spear-light'))).toEqual(['jury-rigged', 'normal', 'mastercrafted']);
    expect(tiersFor(item('crowbar'))).toEqual(['normal']);
  });

  it('takes a week for weapons and armor, half jury-rigged, double mastercrafted', () => {
    expect(buildDays(data, item('spear-light'), 'normal')).toBe(7);
    expect(buildDays(data, item('spear-light'), 'jury-rigged')).toBe(4);
    expect(buildDays(data, item('mail-shirt'), 'mastercrafted')).toBe(14);
    expect(buildDays(data, item('small-shield'), 'normal')).toBe(7);
    expect(buildDays(data, item('crowbar'), 'normal')).toBe(1);
    expect(partsListed(data, item('axe-war'), 'normal')).toBe(50);
    expect(partsListed(data, item('axe-war'), 'jury-rigged')).toBe(12.5);
    expect(partsListed(data, item('axe-war'), 'mastercrafted')).toBe(500);
  });

  it('starts a project in town, paying for the parts', () => {
    const w = rich();
    expect(startProject(w, data, 'm-0', 'axe-war', 'normal')).toEqual({
      ok: false,
      reason: 'Snag has no Craft skill.',
    });
    expect(startProject(w, data, 'm-3', 'crowbar', 'mastercrafted')).toEqual({
      ok: false,
      reason: 'Crowbar is only ever made normal.',
    });
    expect(() => startProject(w, data, 'm-9', 'axe-war', 'normal')).toThrow('no living');
    expect(() => startProject(w, data, 'm-3', 'dungeoneering-kit', 'normal')).toThrow(
      "can't be crafted",
    );
    w.purse = 10;
    expect(startProject(w, data, 'm-3', 'axe-war', 'normal')).toEqual({
      ok: false,
      reason: 'The parts cost 50 crowns.',
    });
    w.purse = 1000;
    expect(startProject(w, data, 'm-3', 'axe-war', 'mastercrafted')).toEqual({ ok: true });
    expect(w.purse).toBe(500);
    expect(w.projects).toEqual([
      {
        crafter: 'm-3',
        kind: 'gear',
        item: 'axe-war',
        quality: 'mastercrafted',
        daysLeft: 14,
        town: 'westhold',
        staying: false,
      },
    ]);
    expect(w.log.at(-1)).toContain('Fizzwick starts on a mastercrafted Axe, War: 14 days of work.');
    expect(startProject(w, data, 'm-3', 'crowbar', 'normal')).toEqual({
      ok: false,
      reason: 'Fizzwick is already making something.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(startProject(w, data, 'm-3', 'crowbar', 'normal')).toMatchObject({ ok: false });
  });

  it('sizes armor for the crafter’s people', () => {
    const w = rich();
    startProject(w, data, 'm-3', 'linothorax', 'jury-rigged');
    expect(w.projects[0]).toMatchObject({ small: true, daysLeft: 4 });
    (w.projects[0] as World['projects'][0]).daysLeft = 1;
    expect(projectText(w, data, w.projects[0] as World['projects'][0])).toBe(
      'Fizzwick: jury-rigged Linothorax (small), 1 day left',
    );
    tools(fizz(w));
    shifts(w, fizz(w), 2);
    expect(fizz(w).character.inventory.at(-1)).toEqual({
      id: 'linothorax',
      quantity: 1,
      location: 'stowed',
      quality: 'jury-rigged',
      small: true,
    });
    w.position = { col: 3, row: 8 };
    startProject(w, data, 'm-3', 'linothorax', 'jury-rigged');
    expect(projectText(w, data, w.projects[0] as World['projects'][0])).toBe(
      'Fizzwick: jury-rigged Linothorax (small), 4 days left',
    );
  });

  it("lets any crafter build small armor for a small member (Small armor, Sam's call)", () => {
    const w = rich();
    const lirael = member(w, 'Lirael');
    lirael.character = { ...lirael.character, skills: { ...lirael.character.skills, craft: 1 } };
    expect(startProject(w, data, 'm-2', 'linothorax', 'normal')).toEqual({ ok: true });
    expect(w.projects[0]).not.toHaveProperty('small');
    w.projects = [];
    expect(startProject(w, data, 'm-2', 'linothorax', 'normal', 'small')).toEqual({ ok: true });
    expect(w.projects[0]).toMatchObject({ crafter: 'm-2', small: true, daysLeft: 7 });
    expect(projectText(w, data, w.projects[0] as World['projects'][0])).toBe(
      'Lirael: Linothorax (small), 7 days left',
    );
    w.projects = [];
    expect(startProject(w, data, 'm-3', 'linothorax', 'normal', 'standard')).toEqual({ ok: true });
    expect(w.projects[0]).not.toHaveProperty('small');
  });

  it('builds small only armor, and the finished suit only fits a small member', () => {
    const w = rich();
    const lirael = member(w, 'Lirael');
    lirael.character = { ...lirael.character, skills: { ...lirael.character.skills, craft: 1 } };
    expect(startProject(w, data, 'm-2', 'crowbar', 'normal', 'small')).toEqual({
      ok: false,
      reason: `${item('crowbar').name} isn't made small.`,
    });
    startProject(w, data, 'm-2', 'linothorax', 'normal', 'small');
    tools(lirael);
    shifts(w, lirael, 14);
    const suit = lirael.character.inventory.at(-1) as InventoryEntry;
    expect(suit).toEqual({ id: 'linothorax', quantity: 1, location: 'stowed', small: true });
    const elf = findPeople(data, lirael.character.people) as People;
    expect(inventoryErrors(data, [suit], elf)).toEqual([]);
    expect(inventoryErrors(data, [{ ...suit, location: 'worn' }], elf)).toEqual([
      'Linothorax is sized for small peoples',
    ]);
  });

  it('works half a day a camp shift with tools out in the wilds, not in town or without tools', () => {
    const w = rich();
    startProject(w, data, 'm-3', 'crowbar', 'normal');
    const f = fizz(w);
    const p = w.projects[0] as World['projects'][0];
    // A made camp alone no longer works the build: it takes a crafter's shift.
    w.position = { col: 4, row: 8 };
    w.camp = 'made';
    pass(w);
    expect(p.daysLeft).toBe(1);
    expect(hasTools(data, f)).toBe(false);
    expect(campProject(w, data, f)).toBeNull();
    craftShift(w, data, f);
    expect(w.log.at(-1)).toContain('Fizzwick has nothing to work on here without tools.');
    tools(f);
    expect(campProject(w, data, f)).toBe(p);
    w.position = { col: 3, row: 8 };
    expect(campProject(w, data, f)).toBeNull();
    craftShift(w, data, f);
    expect(w.log.at(-1)).toContain('Fizzwick has nothing to work on here.');
    const xp = f.character.xp;
    shifts(w, f, 1);
    expect(p.daysLeft).toBe(0.5);
    expect(w.log.at(-1)).toContain('Fizzwick works on the Crowbar.');
    // XP comes in half points: the day's half point once the day is done.
    expect(f.character.xp).toBe(xp);
    expect(projectText(w, data, p)).toBe('Fizzwick: Crowbar, 0.5 days left');
    shifts(w, f, 1);
    expect(f.character.xp).toBe(xp + 0.5);
    expect(w.projects).toEqual([]);
    expect(w.log.at(-1)).toContain('Fizzwick finishes the Crowbar.');
    expect(f.character.inventory.at(-1)).toEqual({
      id: 'crowbar',
      quantity: 1,
      location: 'stowed',
    });
  });

  it.each([
    ['mod', 2],
    ['strip', 3],
  ] as const)('leaves a %s with %d days after two camp shifts', (kind, left) => {
    const w = rich();
    tools(fizz(w));
    w.projects = [
      {
        crafter: 'm-3',
        kind,
        item: 'dagger',
        mod: 'customized',
        target: 's-1',
        quality: 'normal',
        daysLeft: 3,
        town: 'westhold',
        staying: false,
      },
    ];
    shifts(w, fizz(w), 2);
    expect(w.projects[0]?.daysLeft).toBe(left);
  });

  it('sells crafting tools: 100 crowns and 3 items of encumbrance', () => {
    const kit = findItem(data, TOOLS) as CatalogItem;
    expect(kit).toMatchObject({ kind: 'gear', name: 'Crafting Tools', cost: { amount: 100 } });
    expect(kit.kind === 'gear' && kit.gear.encumbrance).toBe(3);
    expect(craftable(data).map((i) => i.id)).not.toContain(TOOLS);
    const pkg = data.content.startingPackages.find((x) => x.id === 'artisan');
    expect(pkg?.items).toEqual([{ id: TOOLS, quantity: 1, location: 'stowed' }]);
  });

  it('builds armor in every tier', () => {
    const ids = craftable(data).map((i) => i.id);
    for (const id of ['war-shirt', 'mail-shirt', 'plate-armor', 'great-armor']) {
      expect(ids).toContain(id);
      expect(tiersFor(item(id))).toEqual(['jury-rigged', 'normal', 'mastercrafted']);
    }
    const w = rich();
    w.purse = 5000;
    expect(startProject(w, data, 'm-3', 'plate-armor', 'normal', 'standard')).toEqual({ ok: true });
    expect(w.projects[0]).toMatchObject({ item: 'plate-armor', daysLeft: 7 });
  });

  it('charges a whole day’s rent for a half day left', () => {
    const w = rich();
    startProject(w, data, 'm-3', 'spear-light', 'normal');
    (w.projects[0] as World['projects'][0]).daysLeft = 2.5;
    const purse = w.purse;
    expect(stayToWork(w, data, 'm-3')).toEqual({ ok: true });
    expect(w.purse).toBe(purse - 15);
    for (let i = 0; i < 3; i++) pass(w);
    expect(w.projects).toEqual([]);
  });

  it('stacks finished normal gear, and keeps crafted tiers on their own lines', () => {
    const w = rich();
    const f = fizz(w);
    f.character = {
      ...f.character,
      inventory: [...f.character.inventory, { id: 'crowbar', quantity: 1, location: 'stowed' }],
    };
    tools(f);
    w.projects = [
      {
        crafter: 'm-3',
        kind: 'gear',
        item: 'crowbar',
        quality: 'normal',
        daysLeft: 1,
        town: 'westhold',
        staying: false,
      },
    ];
    shifts(w, f, 2);
    expect(f.character.inventory.filter((e) => e.id === 'crowbar')).toEqual([
      { id: 'crowbar', quantity: 2, location: 'stowed' },
    ]);
    w.projects = [
      {
        crafter: 'm-3',
        kind: 'gear',
        item: 'dagger',
        quality: 'mastercrafted',
        daysLeft: 1,
        town: 'westhold',
        staying: false,
      },
    ];
    shifts(w, f, 2);
    expect(fizz(w).character.inventory.at(-1)).toEqual({
      id: 'dagger',
      quantity: 1,
      location: 'stowed',
      quality: 'mastercrafted',
      maker: fizz(w).character.id,
    });
  });

  it('works a day at the workshop for rent, then sleeps at the inn', () => {
    const w = rich();
    expect(workDay(w, data)).toEqual({
      ok: false,
      reason: 'No one in the party has work under way.',
    });
    startProject(w, data, 'm-3', 'spear-light', 'normal');
    const day = w.day;
    const purse = w.purse;
    const xp = fizz(w).character.xp;
    expect(workDay(w, data)).toEqual({ ok: true });
    expect(w.day).toBe(day + 1);
    // A day at the bench is worth half an XP to the crafter (Sam's call).
    expect(fizz(w).character.xp).toBe(xp + 0.5);
    // 5 crowns' rent and 12 for four at the inn.
    expect(w.purse).toBe(purse - 17);
    expect(w.projects[0]?.daysLeft).toBe(6);
    w.purse = 10;
    expect(workDay(w, data)).toEqual({
      ok: false,
      reason: "A day's work and a night at the inn cost 17 crowns.",
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(workDay(w, data)).toMatchObject({ ok: false });
  });

  it('can buy the workshop, which then costs no rent', () => {
    const w = rich();
    expect(workshopHere(w, data)).toEqual({ owned: false });
    w.purse = 100;
    expect(buyWorkshop(w, data)).toEqual({ ok: false, reason: 'The workshop costs 500 crowns.' });
    w.purse = 1000;
    expect(buyWorkshop(w, data)).toEqual({ ok: true });
    expect(w.workshops).toEqual(['westhold']);
    expect(buyWorkshop(w, data)).toEqual({
      ok: false,
      reason: 'The party already owns the workshop in Rubblegate.',
    });
    startProject(w, data, 'm-3', 'spear-light', 'normal');
    const purse = w.purse;
    workDay(w, data);
    expect(w.purse).toBe(purse - 12);
    w.encounter = encounter([['thug-or-militia']]);
    expect(buyWorkshop(w, data)).toMatchObject({ ok: false });
  });

  it('has no workshop in a village', () => {
    const w = rich();
    w.position = { col: 17, row: 4 };
    expect(workshopHere(w, data)).toBeNull();
    expect(buyWorkshop(w, data)).toEqual({ ok: false, reason: 'Grimcairn has no workshop.' });
    expect(workDay(w, data)).toEqual({ ok: false, reason: 'Grimcairn has no workshop.' });
    expect(stayToWork(w, data, 'm-3')).toEqual({ ok: false, reason: 'Grimcairn has no workshop.' });
    expect(startProject(w, data, 'm-3', 'crowbar', 'normal')).toEqual({ ok: true });
  });

  it('lets a crafter stay behind to finish, rent paid up front', () => {
    const w = rich();
    startProject(w, data, 'm-3', 'spear-light', 'normal');
    w.purse = 20;
    expect(stayToWork(w, data, 'm-3')).toEqual({
      ok: false,
      reason: "7 days' rent costs 35 crowns.",
    });
    w.purse = 100;
    expect(stayToWork(w, data, 'm-3')).toEqual({ ok: true });
    expect(w.purse).toBe(65);
    expect(w.benched.map((m) => m.id)).toEqual(['m-3']);
    expect(w.log.at(-1)).toContain(
      'Fizzwick stays at the workshop in Rubblegate to finish the Spear, Light (7 days).',
    );
    expect(projectText(w, data, w.projects[0] as World['projects'][0])).toBe(
      'Fizzwick: Spear, Light, 7 days left, at the workshop in Rubblegate',
    );
    expect(rejoin(w, data, 'm-3')).toEqual({
      ok: false,
      reason: 'Fizzwick is still at work in the workshop (7 days left).',
    });
    w.position = { col: 4, row: 8 };
    for (let i = 0; i < 7; i++) pass(w);
    expect(w.projects).toEqual([]);
    expect(w.benched[0]?.character.inventory.at(-1)?.id).toBe('spear-light');
    w.position = { col: 3, row: 8 };
    expect(rejoin(w, data, 'm-3')).toEqual({ ok: true });
    expect(() => stayToWork(w, data, 'm-3')).toThrow('no work to stay for');
  });

  it('keeps someone living in the party', () => {
    const w = rich();
    startProject(w, data, 'm-3', 'spear-light', 'normal');
    for (const m of w.members) if (m.id !== 'm-3') m.dead = true;
    expect(stayToWork(w, data, 'm-3')).toEqual({
      ok: false,
      reason: 'Someone living must stay in the party.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(stayToWork(w, data, 'm-3')).toMatchObject({ ok: false });
  });

  it('can give a project up, parts lost', () => {
    const w = rich();
    expect(abandonProject(w, data, 'm-3')).toEqual({ ok: false, reason: 'Nothing is under way.' });
    startProject(w, data, 'm-3', 'spear-light', 'normal');
    expect(abandonProject(w, data, 'm-3')).toEqual({ ok: true });
    expect(w.projects).toEqual([]);
    expect(w.log.at(-1)).toContain('Fizzwick gives up on the Spear, Light.');
  });

  it('saves projects and workshops, and older saves start with none', () => {
    const w = rich();
    startProject(w, data, 'm-3', 'spear-light', 'normal');
    w.workshops = ['westhold'];
    const back = parseWorld(serializeWorld(w), data);
    expect(back.ok && back.world.projects).toEqual(w.projects);
    expect(back.ok && back.world.workshops).toEqual(['westhold']);
    const save = JSON.parse(serializeWorld(w));
    delete save.projects;
    delete save.workshops;
    save.schemaVersion = 10;
    delete save.components;
    const old = parseWorld(JSON.stringify(save), data);
    expect(old.ok && [old.world.projects, old.world.workshops]).toEqual([[], []]);
  });
});

describe('quality tiers on the sheet (SRD 2.8.1)', () => {
  const people = findPeople(data, 'orc');
  if (!people) throw new Error('missing people');

  it('gives mastercrafted weapons +1 to hit, from any readied line', () => {
    const c = world().members[1]?.character as World['members'][0]['character'];
    const hit = (inv: typeof c.inventory) =>
      characterSheet({ ...c, inventory: inv }, data).equipment.attacks.find(
        (a) => a.id === 'axe-war',
      )?.hit as number;
    const plain = hit(c.inventory);
    const master = c.inventory.map((e) =>
      e.id === 'axe-war' ? { ...e, quality: 'mastercrafted' as const } : e,
    );
    expect(hit(master)).toBe(plain + 1);
    const two = [
      ...c.inventory,
      {
        id: 'axe-war',
        quantity: 1,
        location: 'readied' as const,
        quality: 'mastercrafted' as const,
      },
    ];
    expect(hit(two)).toBe(plain + 1);
  });

  it('lightens mastercrafted armor by 1, never below 1, and prices tiers by their parts', () => {
    const c = world().members[0]?.character as World['members'][0]['character'];
    const load = (inv: typeof c.inventory) =>
      characterSheet({ ...c, inventory: inv }, data).equipment.load.readied;
    const worn = (id: string, quality?: 'mastercrafted') => [
      { id, quantity: 1, location: 'worn' as const, ...(quality ? { quality } : {}) },
    ];
    expect(load(worn('cuirass-and-greaves', 'mastercrafted'))).toBe(
      load(worn('cuirass-and-greaves')) - 1,
    );
    expect(load(worn('linothorax', 'mastercrafted'))).toBe(load(worn('linothorax')));
    expect(load(worn('war-shirt', 'mastercrafted'))).toBe(0);
  });

  it('allows tiers only on weapons, armor, and shields, and shows them', () => {
    const line = {
      id: 'crowbar',
      quantity: 1,
      location: 'stowed' as const,
      quality: 'jury-rigged' as const,
    };
    expect(inventoryErrors(data, [line], people)).toEqual(["Crowbar can't be jury-rigged"]);
    expect(inventoryErrors(data, [{ ...line, id: 'large-shield' }], people)).toEqual([]);
    expect(entryText(data, { ...line, id: 'dagger' })).toBe('Dagger (jury-rigged, stowed)');
    expect((findItem(data, 'dagger') as CatalogItem).kind).toBe('weapon');
  });
});
