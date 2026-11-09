import { describe, expect, it } from 'vitest';
import { alchemistHere } from '../../../src/game/world/alchemists.ts';
import { arenaCard } from '../../../src/game/world/arena.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { workshopHere } from '../../../src/game/world/crafting.ts';
import { craftsmanHere } from '../../../src/game/world/craftsmen.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import {
  grownSize,
  institutionId,
  institutionProject,
  isOpen,
  openServices,
  parseInstitutionId,
} from '../../../src/game/world/institution-projects.ts';
import {
  cannotFound,
  cannotHire,
  foundInstitution,
  hasService,
  hireJourneyman,
  settleCaptive,
  settlers,
} from '../../../src/game/world/institutions.ts';
import { difficultyNow, progressOf, projectOf } from '../../../src/game/world/major-projects.ts';
import { startStrip } from '../../../src/game/world/mods.ts';
import { addNpc, fights, npcMonster } from '../../../src/game/world/npcs.ts';
import { newWorld } from '../../../src/game/world/new-world.ts';
import { shrineHere } from '../../../src/game/world/prayer.ts';
import { raiseListed, raiserHere } from '../../../src/game/world/services.ts';
import { currentTown } from '../../../src/game/world/town-prices.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, member, starter, world } from './helpers.ts';

/** A campaign world standing in a settlement, with crowns to spend. */
function at(region: string, col: number, row: number): World {
  const w = world();
  enterRegion(w, region, { col, row });
  w.position = { col, row };
  w.purse = 1000;
  return w;
}
const lanternfall = () => at('dark-lands', 10, 4);
const cinderhold = () => at('dark-lands', 6, 12);

/** Marks an institution built and staffed. */
function open(w: World, service: Parameters<typeof institutionId>[0], town: string, who = 'Hesk') {
  const id = institutionId(service, town);
  w.majorProjects[id] = { ...progressOf(w, id), done: 0, specialist: who };
  return id;
}

describe('institutions as projects (docs/rules-adaptation.md, Major projects: Institutions)', () => {
  it('names a service and a settlement in its id', () => {
    expect(institutionId('workshop', 'lanternfall')).toBe('inst-workshop-lanternfall');
    expect(parseInstitutionId(data, 'wall-lanternfall')).toBeNull();
    expect(parseInstitutionId(data, 'inst-forge-lanternfall')).toBeNull();
    expect(parseInstitutionId(data, 'inst-workshop-atlantis')).toBeNull();
    expect(parseInstitutionId(data, 'inst-workshop-lanternfall')).toMatchObject({
      region: 'dark-lands',
      site: { name: 'Lanternfall' },
      institution: { service: 'workshop' },
    });
    expect(institutionProject(data, 'wall-lanternfall')).toBeUndefined();
    expect(() => projectOf(data, 'inst-forge-lanternfall')).toThrow('unknown project');
  });

  it('is a project at the settlement’s scope, with the institution’s building work', () => {
    const w = lanternfall();
    const shop = projectOf(data, 'inst-workshop-lanternfall');
    expect(shop).toMatchObject({
      name: 'A workshop in Lanternfall',
      kind: 'institution',
      region: 'dark-lands',
      at: 'lanternfall',
      effect: null,
      build: { crowns: 300, days: 30, skill: 'craft', exert: true },
    });
    expect(difficultyNow(w, data, shop)).toBe(2);
    // A town is a city's scope; the Faithful stand against a crypt (×4).
    expect(difficultyNow(w, data, projectOf(data, 'inst-arena-cinderhold'))).toBe(4);
    expect(difficultyNow(w, data, projectOf(data, 'inst-crypt-lanternfall'))).toBe(8);
  });

  it('opens its service once done and staffed, and three open grow a village into a town', () => {
    const w = lanternfall();
    const id = institutionId('workshop', 'lanternfall');
    w.majorProjects[id] = { ...progressOf(w, id), done: 0 };
    expect(isOpen(w, id)).toBe(false);
    expect(isOpen(w, 'inst-arena-lanternfall')).toBe(false);
    open(w, 'workshop', 'lanternfall');
    open(w, 'arena', 'lanternfall');
    expect(openServices(w, data, 'lanternfall')).toEqual(['workshop', 'arena']);
    const site = currentTown(w, data);
    expect(site?.size).toBe('village');
    open(w, 'alchemist', 'lanternfall');
    expect(currentTown(w, data)?.size).toBe('town');
    // A town stays a town.
    const c = cinderhold();
    const town = currentTown(c, data);
    if (!town) throw new Error('no Cinderhold');
    expect(grownSize(c, data, town)).toBe('town');
  });
});

describe('founding an institution (Sam’s calls: where a service is lacking, one raiser a town)', () => {
  it('knows the services a settlement has, the content’s and the party’s own', () => {
    const w = lanternfall();
    expect(hasService(w, data, 'westhold', 'arena')).toBe(true);
    expect(hasService(w, data, 'cinderhold', 'alchemist')).toBe(true);
    expect(hasService(w, data, 'cinderhold', 'workshop')).toBe(true);
    expect(hasService(w, data, 'lanternfall', 'workshop')).toBe(false);
    expect(hasService(w, data, 'cinderhold', 'crypt')).toBe(true);
    expect(hasService(w, data, 'cinderhold', 'temple')).toBe(false);
    expect(hasService(w, data, 'atlantis', 'workshop')).toBe(false);
    open(w, 'temple', 'lanternfall');
    expect(hasService(w, data, 'lanternfall', 'temple')).toBe(true);
  });

  it('is founded in a settlement that lacks the service, once', () => {
    const w = lanternfall();
    expect(cannotFound(w, data, 'workshop')).toBeNull();
    expect(foundInstitution(w, data, 'workshop')).toEqual({ ok: true });
    expect(w.majorProjects['inst-workshop-lanternfall']).toMatchObject({ renown: 0, done: null });
    expect(w.log.at(-1)).toContain('sets out to found a workshop in Lanternfall');
    expect(foundInstitution(w, data, 'workshop')).toEqual({
      ok: false,
      reason: 'Lanternfall has a workshop under way already.',
    });
    // One place that raises the dead: a crypt founded here bars a temple.
    expect(foundInstitution(w, data, 'crypt')).toEqual({ ok: true });
    expect(cannotFound(w, data, 'temple')).toBe(
      'Lanternfall already has a place that raises the dead.',
    );
  });

  it('is refused where the service already stands, and off a settlement or a buildable world', () => {
    const c = cinderhold();
    expect(cannotFound(c, data, 'workshop')).toBe('Cinderhold has a workshop already.');
    expect(cannotFound(c, data, 'alchemist')).toBe("Cinderhold has an alchemist's shop already.");
    expect(cannotFound(c, data, 'temple')).toBe(
      'Cinderhold already has a place that raises the dead.',
    );
    expect(cannotFound(c, data, 'arena')).toBeNull();
    c.position = { col: 7, row: 12 };
    expect(foundInstitution(c, data, 'arena')).toEqual({
      ok: false,
      reason: 'Institutions are founded in a settlement where the party can build.',
    });
    const party = [
      { character: starter('snag'), row: 0, column: 0, defaultAction: 'auto' as const },
    ];
    const realm = newWorld(data, createRng('realm'), party, undefined, null, 'sealed-vale');
    expect(cannotFound(realm, data, 'arena')).toBe(
      'Institutions are founded in a settlement where the party can build.',
    );
  });
});

describe('the party’s own services (Owner perks; Sam’s call: copied from the nearest)', () => {
  it('a workshop is free to use, brings a smith, and lets gear be stripped in a village', () => {
    const w = lanternfall();
    expect(workshopHere(w, data)).toBeNull();
    expect(craftsmanHere(w, data)).toBeUndefined();
    open(w, 'workshop', 'lanternfall', 'Orra');
    expect(workshopHere(w, data)).toEqual({ owned: true });
    const smith = craftsmanHere(w, data);
    // Cinderhold is nearer Lanternfall than Gutterwick: Grashna's lists.
    expect(smith).toMatchObject({
      id: 'inst-workshop-lanternfall',
      name: 'Orra',
      town: 'lanternfall',
    });
    expect(smith?.weapons).toEqual(
      data.content.craftsmen.find((c) => c.town === 'cinderhold')?.weapons,
    );
    const g = at('borderlands', 17, 4);
    open(g, 'workshop', 'highcairn');
    expect(startStrip(g, data, 'm-0', 'm-0', 0, 'customized')).not.toEqual({
      ok: false,
      reason: 'Grimcairn has no workshop.',
    });
    // Away from a settlement there is no smith.
    w.position = { col: 11, row: 4 };
    expect(craftsmanHere(w, data)).toBeUndefined();
    expect(alchemistHere(w, data)).toBeUndefined();
  });

  it('an alchemist and an arena take the nearest one’s wares and card, or the first anywhere', () => {
    const w = lanternfall();
    expect(alchemistHere(w, data)).toBeUndefined();
    expect(arenaCard(w, data)).toEqual([]);
    open(w, 'alchemist', 'lanternfall', 'Vey');
    open(w, 'arena', 'lanternfall', 'Brug');
    expect(alchemistHere(w, data)).toMatchObject({ name: 'Vey', town: 'lanternfall' });
    // No arena stands in the Dark Lands, so the first card anywhere.
    expect(arenaCard(w, data)).toEqual(data.content.arenaCards[0]?.bouts);
    // The Pale Reach has no smith either.
    const s = at('pale-reach', 10, 12);
    open(s, 'workshop', 'saltwick');
    expect(craftsmanHere(s, data)?.weapons).toEqual(data.content.craftsmen[0]?.weapons);
  });

  it('a crypt, mortuary, or temple raises the party’s dead at half price', () => {
    const w = lanternfall();
    expect(raiserHere(w, data)).toBeUndefined();
    expect(shrineHere(w, data)).toBeUndefined();
    open(w, 'crypt', 'lanternfall', 'Ilse');
    expect(raiserHere(w, data)).toMatchObject({ id: 'inst-crypt-lanternfall', raises: 'crypt' });
    // A crypt is no place to pray.
    expect(shrineHere(w, data)).toBeUndefined();
    const m = lanternfall();
    open(m, 'mortuary', 'lanternfall', 'Aun');
    expect(shrineHere(m, data)).toMatchObject({ name: 'Aun', raises: 'mortuary' });
    const t = lanternfall();
    open(t, 'temple', 'lanternfall', 'Vell');
    expect(raiserHere(t, data)?.raises).toBe('temple');
    const snag = member(w, 'Snag');
    expect(raiseListed(data, snag, 'mortuary', true)).toBe(raiseListed(data, snag, 'mortuary') / 2);
  });

  it('an arena pays the party a quarter of a month of its fees as each month begins', () => {
    const w = lanternfall();
    open(w, 'arena', 'lanternfall');
    const bouts = data.content.arenaCards[0]?.bouts ?? [];
    const average = bouts.reduce((s, b) => s + b.fee, 0) / bouts.length;
    w.day = 29;
    const purse = w.purse;
    emit(w, data, { kind: 'day-passed' });
    // The purse keeps tenths of a crown.
    expect(w.purse).toBe(Math.round((purse + (average * 30) / 4) * 10) / 10);
    expect(w.log.at(-1)).toContain('The arena in Lanternfall pays the party its share');
    // Not on other days, and not for an arena not yet staffed.
    const before = w.purse;
    w.day = 30;
    emit(w, data, { kind: 'day-passed' });
    expect(w.purse).toBe(before);
    const n = lanternfall();
    n.majorProjects['inst-arena-lanternfall'] = progressOf(n, 'inst-arena-lanternfall');
    n.majorProjects['inst-workshop-lanternfall'] = progressOf(n, 'inst-workshop-lanternfall');
    n.day = 29;
    const p = n.purse;
    emit(n, data, { kind: 'day-passed' });
    expect(n.purse).toBe(p);
  });
});

describe('recruits (Sam’s calls: journeymen travel with the party; captives may settle)', () => {
  it('hires a journeyman where the service stands, who settles on reaching the place', () => {
    const w = cinderhold();
    const id = 'inst-workshop-lanternfall';
    expect(cannotHire(w, data, id)).toBe('Found the institution first.');
    expect(hireJourneyman(w, data, id)).toEqual({
      ok: false,
      reason: 'Found the institution first.',
    });
    w.majorProjects[id] = progressOf(w, id);
    expect(cannotHire(w, data, id)).toBeNull();
    w.purse = 0;
    expect(hireJourneyman(w, data, id)).toMatchObject({ ok: false });
    w.purse = 500;
    expect(hireJourneyman(w, data, id)).toEqual({ ok: true });
    const n = w.npcs.find((x) => x.kind === 'recruit');
    if (!n) throw new Error('no journeyman');
    expect(n.type).toBe(id);
    expect(fights(data, n)).toBe(false);
    expect(npcMonster(data, n).id).toBe('peaceful-human');
    expect(w.log.at(-1)).toContain('a journeyman smith, joins the party to settle in Lanternfall');
    expect(cannotHire(w, data, id)).toBe('a journeyman smith is already on the way.');
    // Another town's arrival leaves them be, and other NPCs too; Lanternfall's settles them.
    addNpc(w, data, 'captive', 'merchant', 'peaceful-human', 'Odo', false);
    emit(w, data, { kind: 'town-entered', town: 'gutterwick' });
    expect(w.npcs).toContain(n);
    emit(w, data, { kind: 'town-entered', town: 'lanternfall' });
    expect(w.npcs).not.toContain(n);
    expect(progressOf(w, id).specialist).toBe(n.name);
    expect(cannotHire(w, data, id)).toBe('a journeyman smith already runs it.');
  });

  it('hires only in a town that has the service, never where it is being founded, with room', () => {
    const w = lanternfall();
    const id = 'inst-arena-lanternfall';
    w.majorProjects[id] = progressOf(w, id);
    expect(cannotHire(w, data, id)).toBe('Hire an arena master in a town that has an arena.');
    w.dungeon = {} as World['dungeon'];
    expect(cannotHire(w, data, id)).toBe('Hire an arena master in a town that has an arena.');
    const c = cinderhold();
    const shop = 'inst-workshop-lanternfall';
    c.majorProjects[shop] = progressOf(c, shop);
    for (let i = 0; i < 8; i++)
      addNpc(c, data, 'captive', 'merchant', 'peaceful-human', null, false);
    expect(hireJourneyman(c, data, shop)).toEqual({
      ok: false,
      reason: 'There is no room in the party for them.',
    });
  });

  it('settles a freed captive who fits, in the place, instead of their reward', () => {
    const w = lanternfall();
    const id = 'inst-workshop-lanternfall';
    const crafter = addNpc(w, data, 'captive', 'held-crafter', 'peaceful-human', 'Tamsin', false);
    addNpc(w, data, 'captive', 'merchant', 'peaceful-human', 'Odo', false);
    if (!crafter) throw new Error('no room');
    expect(settleCaptive(w, data, crafter.id, id)).toEqual({
      ok: false,
      reason: "They can't run that.",
    });
    w.majorProjects[id] = progressOf(w, id);
    expect(settlers(w, data, id).map((n) => n.name)).toEqual(['Tamsin']);
    w.position = { col: 6, row: 12 };
    expect(settleCaptive(w, data, crafter.id, id)).toEqual({
      ok: false,
      reason: 'They settle in Lanternfall, where it stands.',
    });
    w.position = { col: 10, row: 4 };
    expect(settleCaptive(w, data, crafter.id, id)).toEqual({ ok: true });
    expect(progressOf(w, id).specialist).toBe('Tamsin');
    expect(w.npcs.some((n) => n.name === 'Tamsin')).toBe(false);
    expect(w.log.at(-1)).toContain('Tamsin stays in Lanternfall to run a workshop');
    const again = addNpc(w, data, 'captive', 'held-crafter', 'peaceful-human', 'Pell', false);
    expect(settleCaptive(w, data, again?.id as string, id)).toEqual({
      ok: false,
      reason: 'a journeyman smith already runs it.',
    });
  });
});
