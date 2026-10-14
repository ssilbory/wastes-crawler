import { describe, expect, it } from 'vitest';
import { camp } from '../../../src/game/world/activities.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import {
  burnFirewood,
  carriesFirewood,
  FIREWOOD,
  gatherFirewood,
  harshHere,
} from '../../../src/game/world/firewood.ts';
import { buyMount } from '../../../src/game/world/mounts.ts';
import { suggestPlan } from '../../../src/game/world/plans.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

/** Mountains, harsh every night; and plains, harsh only in winter. */
const MOUNTAINS = { col: 8, row: 1 };
const PLAINS = { col: 5, row: 9 };

const wood = (quantity = 1) => ({ id: FIREWOOD, quantity, location: 'stowed' as const });
const woodOn = (inventory: { id: string; quantity: number }[]) =>
  inventory.find((e) => e.id === FIREWOOD)?.quantity ?? 0;

function give(m: Member, quantity = 1): void {
  m.character = { ...m.character, inventory: [...m.character.inventory, wood(quantity)] };
}

/** The party out at `at` for the night, with no camp, everyone having slept. */
function outAt(at = MOUNTAINS): World {
  const w = world();
  w.position = at;
  w.camp = 'none';
  for (const m of w.members) m.slept = true;
  return w;
}

/** A party with a pack bison, bought in Rubblegate. */
function withBison(): World {
  const w = world();
  w.purse = 100000;
  expect(buyMount(w, data, 'pack-bison')).toEqual({ ok: true });
  return w;
}

const bison = (w: World) => w.npcs[0] as World['npcs'][number];

describe('where the night is harsh', () => {
  it('is harsh in harsh terrain or winter, and never underground', () => {
    const w = outAt();
    expect(harshHere(w, data)).toBe(true);
    w.position = PLAINS;
    expect(harshHere(w, data)).toBe(false);
    w.day = 300;
    expect(harshHere(w, data)).toBe(true);
    w.dungeon = {} as World['dungeon'];
    expect(harshHere(w, data)).toBe(false);
  });
});

describe('burning firewood (SRD 2.12.4)', () => {
  it('takes it from a living member first, then a pack beast', () => {
    const w = withBison();
    expect(carriesFirewood(w, data)).toBe(false);
    expect(burnFirewood(w, data)).toBeNull();
    const fizz = member(w, 'Fizzwick');
    give(fizz, 2);
    give(member(w, 'Snag'));
    member(w, 'Snag').dead = true;
    bison(w).inventory = [wood()];
    expect(carriesFirewood(w, data)).toBe(true);
    expect(burnFirewood(w, data)).toBe('Fizzwick');
    expect(woodOn(fizz.character.inventory)).toBe(1);
    expect(burnFirewood(w, data)).toBe('Fizzwick');
    expect(woodOn(fizz.character.inventory)).toBe(0);
    expect(burnFirewood(w, data)).toBe('Pack Bison');
    expect(bison(w).inventory).toEqual([]);
    expect(burnFirewood(w, data)).toBeNull();
    expect(carriesFirewood(w, data)).toBe(false);
  });

  it('keeps off the cold on a harsh night, but gives no shelter', () => {
    const w = outAt();
    give(member(w, 'Lirael'));
    endOfDay(w, data);
    expect(w.members.some((m) => m.cold)).toBe(false);
    expect(woodOn(member(w, 'Lirael').character.inventory)).toBe(0);
    expect(w.log).toContainEqual(
      expect.stringContaining("Lirael builds a fire from a night's firewood."),
    );
    expect(w.log.at(-1)).toContain('A night without shelter at 8,1: no one recovers.');
    // With none left, the next harsh night is Cold.
    for (const m of w.members) m.slept = true;
    endOfDay(w, data);
    expect(member(w, 'Snag').cold).toBe(true);
  });

  it('is kept when no one would feel the cold', () => {
    const w = outAt();
    give(member(w, 'Snag'));
    w.camp = 'made';
    endOfDay(w, data);
    expect(woodOn(member(w, 'Snag').character.inventory)).toBe(1);
    const mild = outAt(PLAINS);
    give(member(mild, 'Snag'));
    endOfDay(mild, data);
    expect(woodOn(member(mild, 'Snag').character.inventory)).toBe(1);
    // Elemental Resilience keeps the cold off everyone.
    const hardy = outAt();
    for (const m of hardy.members)
      m.character = { ...m.character, arts: [...m.character.arts, 'elemental-resilience'] };
    give(member(hardy, 'Snag'));
    endOfDay(hardy, data);
    expect(woodOn(member(hardy, 'Snag').character.inventory)).toBe(1);
    expect(hardy.members.some((m) => m.cold)).toBe(false);
  });
});

describe('gathering firewood (SRD 2.12.5)', () => {
  it('needs a gatherer, and the best of them rolls at the forage difficulty', () => {
    const w = outAt();
    expect(gatherFirewood(w, data, [], 9)).toBe(false);
    w.rng = scriptedThen([1, 1], createRng('wood'));
    expect(gatherFirewood(w, data, [member(w, 'Snag')], 9)).toBe(true);
    expect(w.log.at(-1)).toContain('Snag finds nothing to burn.');
    w.rng = scriptedThen([6, 6], createRng('wood'));
    expect(gatherFirewood(w, data, [member(w, 'Snag')], 9)).toBe(true);
    expect(w.log.at(-1)).toContain("Snag gathers a night's firewood.");
    expect(woodOn(member(w, 'Snag').character.inventory)).toBe(1);
  });

  it('hands it to a pack beast when the finder is full, or leaves it', () => {
    const w = withBison();
    const snag = member(w, 'Snag');
    give(snag, 10);
    w.rng = scriptedThen([6, 6], createRng('wood'));
    gatherFirewood(w, data, [snag], 9);
    expect(woodOn(snag.character.inventory)).toBe(10);
    expect(woodOn(bison(w).inventory)).toBe(1);
    expect(w.log.at(-1)).toContain("Snag gathers a night's firewood for Pack Bison to carry.");
    bison(w).inventory = [wood(7)];
    w.rng = scriptedThen([6, 6], createRng('wood'));
    gatherFirewood(w, data, [snag], 9);
    expect(woodOn(bison(w).inventory)).toBe(7);
    expect(w.log.at(-1)).toContain('Snag gathers firewood, but no one has room to carry it.');
  });

  it('is a camp activity outside town that draws an encounter check', () => {
    const w = outAt();
    const snag = member(w, 'Snag');
    w.rng = scriptedThen([6, 6], createRng('wood'));
    expect(camp(w, data, { [snag.id]: 'firewood' }).extraChecks).toBe(1);
    expect(woodOn(snag.character.inventory)).toBe(1);
    const town = world();
    expect(camp(town, data, { [member(town, 'Snag').id]: 'firewood' }).extraChecks).toBe(0);
  });

  it('is in the evening plan on a harsh night with no wood packed and no camp made', () => {
    const w = outAt();
    w.quarter = 2;
    const gatherers = () =>
      Object.values((suggestPlan(w, data) as { activities: object }).activities).filter(
        (a) => a === 'firewood',
      );
    expect(gatherers()).toHaveLength(1);
    give(member(w, 'Snag'));
    expect(gatherers()).toHaveLength(0);
    member(w, 'Snag').character.inventory.pop();
    w.camp = 'made';
    expect(gatherers()).toHaveLength(0);
    w.camp = 'none';
    w.position = PLAINS;
    expect(gatherers()).toHaveLength(0);
  });
});
