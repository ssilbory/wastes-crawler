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
import { addNpc } from '../../../src/game/world/npcs.ts';
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

function hurt(m: Member): void {
  m.character = { ...m.character, hp: { ...m.character.hp, current: 3 } };
}

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

  it('takes it from a riding mount above ground', () => {
    const w = world();
    w.purse = 100000;
    expect(buyMount(w, data, 'riding-elk')).toEqual({ ok: true });
    const elk = w.mounts[0] as World['mounts'][number];
    elk.inventory = [wood()];
    expect(carriesFirewood(w, data)).toBe(true);
    expect(burnFirewood(w, data)).toBe(elk.name);
    expect(elk.inventory).toEqual([]);
  });

  it('keeps off the cold on a harsh night, and lets the party rest', () => {
    const w = outAt();
    hurt(member(w, 'Grukk'));
    give(member(w, 'Lirael'));
    endOfDay(w, data);
    expect(w.members.some((m) => m.cold)).toBe(false);
    expect(woodOn(member(w, 'Lirael').character.inventory)).toBe(0);
    expect(w.log).toContainEqual(
      expect.stringContaining("Lirael builds a fire from a night's firewood."),
    );
    expect(member(w, 'Grukk').character.hp.current).toBeGreaterThan(3);
    expect(w.log.some((l) => l.includes('no one recovers'))).toBe(false);
    // With none left, the next harsh night is Cold.
    for (const m of w.members) m.slept = true;
    endOfDay(w, data);
    expect(member(w, 'Snag').cold).toBe(true);
  });

  it('burns on a mild night without a camp, so the party can rest', () => {
    const w = outAt(PLAINS);
    hurt(member(w, 'Grukk'));
    give(member(w, 'Snag'));
    endOfDay(w, data);
    expect(woodOn(member(w, 'Snag').character.inventory)).toBe(0);
    expect(member(w, 'Grukk').character.hp.current).toBeGreaterThan(3);
  });

  it('burns for the cold alone when a spoiled camp blocks rest', () => {
    const w = outAt();
    w.noRecovery = true;
    hurt(member(w, 'Grukk'));
    give(member(w, 'Snag'));
    endOfDay(w, data);
    expect(woodOn(member(w, 'Snag').character.inventory)).toBe(0);
    expect(w.members.some((m) => m.cold)).toBe(false);
    expect(member(w, 'Grukk').character.hp.current).toBe(3);
    expect(w.log).toContainEqual(
      expect.stringContaining('The fire keeps off the cold, but no one recovers.'),
    );
  });

  it('is kept when it would do no good', () => {
    const camped = outAt();
    give(member(camped, 'Snag'));
    camped.camp = 'made';
    endOfDay(camped, data);
    expect(woodOn(member(camped, 'Snag').character.inventory)).toBe(1);
    // A spoiled camp on a mild night: no one could rest, and no one is cold.
    const mild = outAt(PLAINS);
    mild.noRecovery = true;
    give(member(mild, 'Snag'));
    endOfDay(mild, data);
    expect(woodOn(member(mild, 'Snag').character.inventory)).toBe(1);
    // A mild night with nothing to eat: everyone is Hungry, so no one could rest.
    const starving = outAt(PLAINS);
    starving.rations = 0;
    give(member(starving, 'Snag'));
    endOfDay(starving, data);
    expect(woodOn(member(starving, 'Snag').character.inventory)).toBe(1);
    // A mild night when no one slept: everyone is Sleepless.
    const wakeful = outAt(PLAINS);
    for (const m of wakeful.members) m.slept = false;
    give(member(wakeful, 'Snag'));
    endOfDay(wakeful, data);
    expect(woodOn(member(wakeful, 'Snag').character.inventory)).toBe(1);
    // Elemental Resilience keeps the cold off everyone.
    const hardy = outAt();
    hardy.noRecovery = true;
    for (const m of hardy.members)
      m.character = { ...m.character, arts: [...m.character.arts, 'elemental-resilience'] };
    give(member(hardy, 'Snag'));
    endOfDay(hardy, data);
    expect(woodOn(member(hardy, 'Snag').character.inventory)).toBe(1);
    expect(hardy.members.some((m) => m.cold)).toBe(false);
    // A physician keeps off the cold too (Sam's call).
    const tended = outAt();
    tended.noRecovery = true;
    addNpc(tended, data, 'hireling', 'mundane-physician', 'peaceful-human', 'Doc', false);
    give(member(tended, 'Snag'));
    endOfDay(tended, data);
    expect(woodOn(member(tended, 'Snag').character.inventory)).toBe(1);
    expect(tended.members.some((m) => m.cold)).toBe(false);
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
    // A failed search draws the check all the same.
    w.rng = scriptedThen([1, 1], createRng('wood'));
    expect(camp(w, data, { [snag.id]: 'firewood' }).extraChecks).toBe(1);
    expect(woodOn(snag.character.inventory)).toBe(1);
    const town = world();
    expect(camp(town, data, { [member(town, 'Snag').id]: 'firewood' }).extraChecks).toBe(0);
  });

  it('is in the evening plan outdoors whenever no wood is packed and no camp is made', () => {
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
    // A mild night still wants wood, since a fire lets the party rest if the camp fails.
    w.camp = 'none';
    w.position = PLAINS;
    expect(gatherers()).toHaveLength(1);
    w.dungeon = {} as World['dungeon'];
    expect(gatherers()).toHaveLength(0);
  });

  it('is in the evening plan even when no one would feel the cold', () => {
    const plan = (w: World) =>
      Object.values((suggestPlan(w, data) as { activities: object }).activities);
    const hardy = outAt();
    hardy.quarter = 2;
    for (const m of hardy.members)
      m.character = { ...m.character, arts: [...m.character.arts, 'elemental-resilience'] };
    expect(plan(hardy)).toContain('firewood');
    const tended = outAt();
    tended.quarter = 2;
    addNpc(tended, data, 'hireling', 'mundane-physician', 'peaceful-human', 'Doc', false);
    expect(plan(tended)).toContain('firewood');
  });
});
