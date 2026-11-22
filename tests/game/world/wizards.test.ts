import { describe, expect, it } from 'vitest';
import { crafterReferenceErrors } from '../../../src/data/crafter-check.ts';
import { contentCrafters } from '../../../src/data/crafters.ts';
import { crafterKindsAt, crafterRoom } from '../../../src/game/world/crafter-places.ts';
import { enterRegion } from '../../../src/game/world/enter-region.ts';
import { cannotFound, foundInstitution } from '../../../src/game/world/institutions.ts';
import { institutionId } from '../../../src/game/world/institution-projects.ts';
import { progressOf } from '../../../src/game/world/major-projects.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { townHere } from '../../../src/game/world/town-prices.ts';
import type { World } from '../../../src/game/world/types.ts';
import {
  drawWizardPiece,
  maxSpellLevel,
  wizardMisfit,
  wizardPieceName,
  wizardSpells,
  wizardStockPrice,
  wizardTerms,
} from '../../../src/game/world/wizard-wares.ts';
import {
  buyWizardPiece,
  collectWizardPiece,
  orderWizardPiece,
  visitWizard,
  wizardHere,
  wizardState,
} from '../../../src/game/world/wizards.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from './helpers.ts';

const wizards = data.content.wizards.wizards;
const hask = wizards.find((x) => x.id === 'wizard-mirewatch') as (typeof wizards)[number];
const vorne = wizards.find((x) => x.id === 'wizard-saltwick') as typeof hask;

/** The starters standing in a settlement with crowns to spend, the given faces next. */
function at(region: string, col: number, row: number, faces: number[] = []): World {
  const w = world();
  enterRegion(w, region, { col, row });
  w.position = { col, row };
  w.purse = 3000;
  w.rng = scriptedRng(faces);
  return w;
}
const mirewatch = (faces: number[] = []) => at('dark-lands', 13, 20, faces);
const lanternfall = () => at('dark-lands', 10, 4);

describe('wizards (docs/rules-adaptation.md, Potions, scrolls, and magic devices: Wizards)', () => {
  it('reach the spell level their caster level does, and only their own tradition', () => {
    expect([hask.tradition, hask.level, maxSpellLevel(data, hask)]).toEqual(['necromancer', 5, 3]);
    expect(maxSpellLevel(data, vorne)).toBe(4);
    for (const wz of wizards)
      for (const into of ['scroll', 'device'] as const) {
        const spells = wizardSpells(data, wz, into);
        expect(spells.length).toBeGreaterThan(0);
        expect(spells.every((s) => s.tradition === wz.tradition)).toBe(true);
        expect(Math.max(...spells.map((s) => s.level))).toBeLessThanOrEqual(
          maxSpellLevel(data, wz),
        );
      }
    // Spells cast only outside fights go on scrolls, never in devices (Phase 21).
    const scroll = wizardSpells(data, hask, 'scroll').map((s) => s.id);
    const device = wizardSpells(data, hask, 'device').map((s) => s.id);
    expect(scroll).toContain('raise-corpse');
    expect(device).not.toContain('raise-corpse');
  });

  it('make only their tradition’s spells and rods', () => {
    expect(wizardMisfit(data, hask, { item: 'scroll', spells: ['smite-the-dead'] })).toBeNull();
    const highMagic = 'the-coruscating-coffin';
    expect(wizardMisfit(data, hask, { item: 'scroll', spells: [highMagic] })).toBe(
      'Widow Hask writes only necromancer spells up to level 3 that fit it.',
    );
    expect(wizardMisfit(data, hask, { item: 'scroll', spells: ['boneshaper'] })).toBe(
      'Widow Hask writes only necromancer spells up to level 3 that fit it.',
    );
    expect(wizardMisfit(data, hask, { item: 'scroll', spells: [] })).toBe(
      'A scroll holds one spell.',
    );
    expect(wizardMisfit(data, hask, { item: 'rod-of-mending', spells: [] })).toBeNull();
    expect(wizardMisfit(data, hask, { item: 'rod-of-light', spells: [] })).toBe(
      "Widow Hask doesn't make a Rod of Light.",
    );
    expect(wizardMisfit(data, vorne, { item: 'rod-of-warding', spells: [] })).toBeNull();
    // A wand holds level 1 or 2; a necromancer's raise-corpse never goes in a device.
    expect(wizardMisfit(data, hask, { item: 'wand', spells: ['compel-flesh'] })).toBe(
      'A wand holds a spell of level 2 or less.',
    );
    expect(wizardMisfit(data, hask, { item: 'wand', spells: ['raise-corpse'] })).toBe(
      'Widow Hask writes only necromancer spells up to level 3 that fit it.',
    );
    expect(
      wizardMisfit(data, hask, { item: 'arcane-staff', spells: ['compel-flesh', 'merge-souls'] }),
    ).toBe("A staff's spells come to 5 levels at most.");
    expect(() => wizardMisfit(data, hask, { item: 'dagger', spells: [] })).toThrow(
      "dagger isn't a scroll or device",
    );
  });

  it('price orders at the full making price, and stock at four times that', () => {
    const scroll = { item: 'scroll', spells: ['final-death'] };
    expect(wizardTerms(data, scroll)).toEqual({
      crowns: 40,
      components: [
        { type: 'hide', count: 1 },
        { type: 'essence', count: 1 },
      ],
      days: 7,
    });
    expect(wizardStockPrice(data, scroll)).toBe(160);
    const staff = { item: 'arcane-staff', spells: ['compel-flesh', 'smite-the-dead'] };
    expect(wizardTerms(data, staff)).toEqual({ crowns: 400, components: [], days: 30 });
    expect(wizardTerms(data, { item: 'rod-of-mending', spells: [] }).crowns).toBe(300);
    expect(wizardPieceName(data, staff)).toBe('Staff of Compel Flesh and Smite the Dead');
    expect(wizardPieceName(data, { item: 'rod-of-mending', spells: [] })).toBe('Rod of Mending');
  });

  it('draw scrolls, wands, staves, and rods of their own for the month', () => {
    // Three draws: a scroll (the first spell), a wand (the fourth of level 2 or less), a rod.
    const w = mirewatch([3, 1, 0, 7, 3, 10, 0]);
    expect(wizardHere(w, data)?.name).toBe('Widow Hask');
    expect(wizardState(w, data, hask)).toBeNull();
    expect(visitWizard(w, data)).toEqual({ ok: true });
    expect(wizardState(w, data, hask)).toEqual({
      since: 0,
      stock: [
        { item: 'scroll', spells: ['smite-the-dead'] },
        { item: 'wand', spells: ['final-death'] },
        { item: 'rod-of-mending', spells: [] },
      ],
    });
    // Called on again the same month, nothing is drawn.
    expect(visitWizard(w, data)).toEqual({ ok: true });
    // A staff: a first spell, then a second that keeps both within five levels.
    w.rng = scriptedRng([9, 4, 0]);
    expect(drawWizardPiece(w, data, hask)).toEqual({
      item: 'arcane-staff',
      spells: ['compel-flesh', 'smite-the-dead'],
    });
    // With nothing of a kind to make, the draw is lost.
    const none = { ...hask, tradition: 'elementalist' as const };
    const bare = {
      ...data,
      content: {
        ...data.content,
        devices: {
          ...data.content.devices,
          devices: data.content.devices.devices.filter((d) => d.id !== 'rod-of-light'),
        },
      },
    };
    w.rng = scriptedRng([10]);
    expect(drawWizardPiece(w, bare, none)).toBeNull();
    // A tradition with no spells at all loses every scroll, wand, and staff draw.
    const noNecro = {
      ...data,
      srd: { ...data.srd, spells: data.srd.spells.filter((x) => x.tradition !== 'necromancer') },
      content: {
        ...data.content,
        spellRules: {
          ...data.content.spellRules,
          added: data.content.spellRules.added.filter((x) => x.tradition !== 'necromancer'),
        },
      },
    };
    for (const face of [1, 7, 9]) {
      w.rng = scriptedRng([face]);
      expect(drawWizardPiece(w, noNecro, hask)).toBeNull();
    }
    // Lost draws leave the month's stock short.
    const v = mirewatch([2, 1, 7]);
    visitWizard(v, noNecro);
    expect(v.wizards[hask.id]?.stock).toEqual([]);
  });

  it('are called on first, outside a fight, and only where one works', () => {
    const w = mirewatch();
    expect(buyWizardPiece(w, data, 0, 'm-0')).toEqual({
      ok: false,
      reason: 'Call on Widow Hask first.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(orderWizardPiece(w, data, { item: 'rod-of-mending', spells: [] })).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    const l = lanternfall();
    expect(wizardHere(l, data)).toBeUndefined();
    expect(visitWizard(l, data)).toEqual({ ok: false, reason: 'No wizard works in Lanternfall.' });
    expect(buyWizardPiece(l, data, 0, 'm-0')).toEqual({
      ok: false,
      reason: 'No wizard works in Lanternfall.',
    });
    expect(collectWizardPiece(w, data, 0, 'm-0')).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    // Out on the road, no one is here at all.
    l.position = { col: 9, row: 4 };
    expect(wizardHere(l, data)).toBeUndefined();
  });

  it('sell ready-made pieces that go off at their level', () => {
    const w = mirewatch([2, 1, 0, 7, 3]);
    visitWizard(w, data);
    expect(() => buyWizardPiece(w, data, 7, 'm-0')).toThrow('no stock line 7');
    expect(() => buyWizardPiece(w, data, 0, 'm-9')).toThrow('no living party member m-9');
    w.purse = 10;
    expect(buyWizardPiece(w, data, 0, 'm-0')).toEqual({
      ok: false,
      reason: 'That costs 80 crowns.',
    });
    w.purse = 3000;
    expect(buyWizardPiece(w, data, 0, 'm-0')).toEqual({ ok: true });
    expect(w.purse).toBe(2920);
    expect(member(w, 'Snag').character.inventory.at(-1)).toEqual({
      id: 'scroll',
      quantity: 1,
      location: 'stowed',
      spell: 'smite-the-dead',
      casterLevel: 5,
    });
    expect(w.log.at(-1)).toContain('Snag buys a Scroll of Smite the Dead from Widow Hask.');
    // A wand's charges are rolled as it is handed over: 2d4+2.
    w.rng = scriptedRng([3, 4]);
    expect(buyWizardPiece(w, data, 0, 'm-1')).toEqual({ ok: true });
    expect(member(w, 'Grukk').character.inventory.at(-1)).toEqual({
      id: 'wand',
      quantity: 1,
      location: 'stowed',
      spells: ['final-death'],
      casterLevel: 5,
      charges: 9,
    });
    expect(wizardState(w, data, hask)?.stock).toEqual([]);
  });

  it('make pieces to order for crowns and a scroll’s components, collected here', () => {
    const w = mirewatch([0]);
    visitWizard(w, data);
    const scroll = { item: 'scroll', spells: ['final-death'] };
    expect(orderWizardPiece(w, data, { item: 'rod-of-light', spells: [] })).toEqual({
      ok: false,
      reason: "Widow Hask doesn't make a Rod of Light.",
    });
    expect(orderWizardPiece(w, data, scroll)).toEqual({
      ok: false,
      reason: 'It needs 1 hide, 1 essence.',
    });
    w.components = { 'beast-hide': 1, 'spore-essence': 1 };
    w.purse = 10;
    expect(orderWizardPiece(w, data, scroll)).toEqual({
      ok: false,
      reason: 'Widow Hask asks 40 crowns.',
    });
    w.purse = 3000;
    expect(orderWizardPiece(w, data, scroll)).toEqual({ ok: true });
    expect(w.components).toEqual({});
    expect(w.wizardOrders).toEqual([{ wizard: hask.id, ...scroll, readyDay: 7 }]);
    expect(w.log.at(-1)).toContain('Widow Hask takes on a Scroll of Final Death: ready in 7 days.');
    expect(orderWizardPiece(w, data, { item: 'rod-of-mending', spells: [] })).toEqual({
      ok: true,
    });
    expect(w.wizardOrders[1]?.readyDay).toBe(30);
    expect(collectWizardPiece(w, data, 0, 'm-2')).toEqual({
      ok: false,
      reason: 'Not ready for 7 days.',
    });
    expect(() => collectWizardPiece(w, data, 5, 'm-2')).toThrow('no order 5 here');
    w.day = 7;
    w.wizards[hask.id] = { since: 7, stock: [] };
    expect(collectWizardPiece(w, data, 0, 'm-2')).toEqual({ ok: true });
    expect(member(w, 'Lirael').character.inventory.at(-1)).toMatchObject({
      id: 'scroll',
      spell: 'final-death',
      casterLevel: 5,
    });
    expect(w.log.at(-1)).toContain('Lirael collects the Scroll of Final Death from Widow Hask.');
    expect(w.wizardOrders).toHaveLength(1);
  });

  it('keep their months and orders in the save', () => {
    const w = mirewatch();
    w.rng = createRng('wizard save');
    visitWizard(w, data);
    w.wizardOrders = [{ wizard: hask.id, item: 'rod-of-mending', spells: [], readyDay: 30 }];
    const back = parseWorld(serializeWorld(w), data);
    if (!back.ok) throw new Error(back.errors.join('; '));
    expect(back.world.wizards).toEqual(w.wizards);
    expect(back.world.wizardOrders).toEqual(w.wizardOrders);
  });
});

describe('crafter places (docs/rules-adaptation.md, Crafters)', () => {
  it('count the content’s crafters and the party’s own', () => {
    expect(contentCrafters(data.content, 'westhold')).toEqual(['smith', 'alchemist']);
    expect(contentCrafters(data.content, 'saltwick')).toEqual(['wizard']);
    expect(contentCrafters(data.content, 'lanternfall')).toEqual([]);
    const w = lanternfall();
    expect(crafterKindsAt(w, data, 'lanternfall')).toEqual([]);
    w.majorProjects[institutionId('alchemist', 'lanternfall')] = progressOf(
      w,
      institutionId('alchemist', 'lanternfall'),
    );
    expect(crafterKindsAt(w, data, 'lanternfall')).toEqual(['alchemist']);
    const site = townHere(w, data);
    expect(crafterRoom(w, data, site, 'alchemist')).toBe(true);
    expect(crafterRoom(w, data, site, 'wizard')).toBe(false);
  });

  it('give a village room for one kind, and a grown village a town’s two', () => {
    const w = lanternfall();
    expect(cannotFound(w, data, 'sanctum')).toBeNull();
    expect(foundInstitution(w, data, 'sanctum')).toEqual({ ok: true });
    expect(cannotFound(w, data, 'workshop')).toBe(
      'Lanternfall has no room for another kind of crafter.',
    );
    expect(cannotFound(w, data, 'alchemist')).toBe(
      'Lanternfall has no room for another kind of crafter.',
    );
    // Other institutions take no crafter's place.
    expect(cannotFound(w, data, 'arena')).toBeNull();
    // Three services open grow it into a town (Growth), with a second place.
    for (const s of ['sanctum', 'arena', 'temple'] as const) {
      const id = institutionId(s, 'lanternfall');
      w.majorProjects[id] = { ...progressOf(w, id), done: 0, specialist: 'Hesk' };
    }
    expect(cannotFound(w, data, 'alchemist')).toBeNull();
  });

  it('open a sanctum’s wizard with the nearest wizard’s tradition', () => {
    const w = lanternfall();
    const id = institutionId('sanctum', 'lanternfall');
    w.majorProjects[id] = { ...progressOf(w, id), done: 0, specialist: 'Hesk' };
    expect(wizardHere(w, data)).toMatchObject({
      id,
      name: 'Hesk',
      town: 'lanternfall',
      tradition: 'necromancer',
      level: 5,
      text: "Hesk keeps the party's sanctum, and learned the craft from Widow Hask.",
    });
  });

  it('are checked: real towns, one wizard each, real levels, a rod each, and room', () => {
    const { srd, content } = data;
    expect(crafterReferenceErrors(srd, content)).toEqual([]);
    const broken = {
      ...content,
      wizards: {
        ...content.wizards,
        wizards: [
          ...content.wizards.wizards,
          { ...hask, id: 'twin' },
          { ...hask, id: 'lost', town: 'atlantis' },
          { ...hask, id: 'crowded', town: 'westhold' },
        ],
      },
      devices: {
        ...content.devices,
        devices: content.devices.devices.filter((d) => d.id !== 'rod-of-light'),
      },
    };
    expect(crafterReferenceErrors(srd, broken)).toEqual([
      'wizards/twin: mirewatch already has a wizard',
      'wizards/lost: unknown town atlantis',
      'devices: no rod for elementalist',
      'westhold: 3 kinds of crafter, room for 2',
    ]);
    const offLevel = { ...content.wizards, wizards: [{ ...hask, level: 11 }] };
    expect(crafterReferenceErrors(srd, { ...content, wizards: offLevel })).toEqual([
      'wizards/wizard-mirewatch: level 11 is off the progression',
    ]);
    const offTrack = { ...content.wizards, progression: 'nothing' };
    expect(crafterReferenceErrors(srd, { ...content, wizards: offTrack })).toEqual([
      'wizards: unknown progression nothing',
    ]);
  });
});
