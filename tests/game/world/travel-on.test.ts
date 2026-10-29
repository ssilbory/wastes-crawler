import { describe, expect, it } from 'vitest';
import type { GameData } from '../../../src/game/character/context.ts';
import { setDestination } from '../../../src/game/world/plans.ts';
import { snapshot, stopAfter, travelOn } from '../../../src/game/world/travel-on.ts';
import type { World } from '../../../src/game/world/types.ts';
import { hexKey } from '../../../src/rules/hex.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Content where nothing is ever met on the road, so a trip runs to its end. */
const quiet: GameData = {
  ...data,
  content: {
    ...data.content,
    overlandRules: {
      ...data.content.overlandRules,
      encounterDice: Object.fromEntries(
        Object.keys(data.content.overlandRules.encounterDice).map((k) => [k, 1_000_000]),
      ) as GameData['content']['overlandRules']['encounterDice'],
    },
  },
};

/** A world heading for a hex `cols` columns east of the start. */
function heading(cols: number): { w: World; target: string } {
  const w = world();
  const to = { col: w.position.col + cols, row: w.position.row };
  expect(setDestination(w, quiet, to)).toBe(true);
  return { w, target: hexKey(to) };
}

describe('travelOn', () => {
  it('needs a destination', () => {
    expect(travelOn(world(), quiet)).toEqual({
      quarters: 0,
      stop: 'Pick a hex to travel to first.',
    });
  });

  it('hikes and camps quarter after quarter until the party arrives', () => {
    const { w, target } = heading(4);
    const r = travelOn(w, quiet);
    expect(r.stop).toBe('The party arrives.');
    expect(r.quarters).toBeGreaterThan(0);
    expect(hexKey(w.position)).toBe(target);
    expect(w.destination).toBeNull();
  });

  it("won't travel over a pending encounter", () => {
    const { w } = heading(4);
    w.encounter = encounter([['thug-or-militia']]);
    expect(travelOn(w, quiet)).toEqual({ quarters: 0, stop: "The party can't travel on now." });
  });

  it('pauses after its limit of quarters', () => {
    const { w } = heading(4);
    expect(travelOn(w, quiet, 1)).toEqual({
      quarters: 1,
      stop: 'A week on the road: the party pauses.',
    });
  });
});

describe('stopAfter', () => {
  const at = (w: World) => hexKey(w.position);

  it('goes on while nothing has changed but the road', () => {
    const { w, target } = heading(4);
    expect(stopAfter(w, snapshot(w), target)).toBeNull();
  });

  it('stops for an encounter', () => {
    const { w, target } = heading(4);
    const before = snapshot(w);
    w.encounter = encounter([['thug-or-militia']]);
    expect(stopAfter(w, before, target)).toBe('Something on the road stops the party.');
  });

  it('stops when a member dies, is hurt, or takes strain', () => {
    const { w, target } = heading(4);
    const snag = member(w, 'Snag');
    let before = snapshot(w);
    snag.dead = true;
    expect(stopAfter(w, before, target)).toBe('Snag has died.');
    snag.dead = false;
    before = snapshot(w);
    snag.character = { ...snag.character, hp: { ...snag.character.hp, current: 1 } };
    expect(stopAfter(w, before, target)).toBe('Snag is hurt.');
    before = snapshot(w);
    const strain = snag.character.strain;
    snag.character = { ...snag.character, strain: { ...strain, value: strain.value + 1 } };
    expect(stopAfter(w, before, target)).toBe('Snag takes System Strain.');
  });

  it('stops when a quest changes', () => {
    const { w, target } = heading(4);
    const before = snapshot(w);
    w.quests['some-quest'] = { status: 'active', step: 0, acceptedDay: 0 };
    expect(stopAfter(w, before, target)).toBe('A quest has changed.');
  });

  it('stops when the rations or water run out, not when they were out already', () => {
    const { w, target } = heading(4);
    let before = snapshot(w);
    w.rations = 0;
    expect(stopAfter(w, before, target)).toBe('The rations are gone.');
    before = snapshot(w);
    expect(stopAfter(w, before, target)).toBeNull();
    w.water = 0;
    expect(stopAfter(w, before, target)).toBe('The water is gone.');
    before = snapshot(w);
    expect(stopAfter(w, before, target)).toBeNull();
  });

  it('stops when the journey takes a turn: underground, on a coach, or at the realm end', () => {
    for (const change of [
      (w: World) => (w.dungeon = {} as World['dungeon']),
      (w: World) => (w.coach = {} as World['coach']),
      (w: World) => (w.realmEnd = 'reached'),
    ]) {
      const { w, target } = heading(4);
      const before = snapshot(w);
      change(w);
      expect(stopAfter(w, before, target)).toBe('The journey takes a turn.');
    }
  });

  it('tells arriving from getting no closer', () => {
    const { w, target } = heading(4);
    const before = snapshot(w);
    w.destination = null;
    expect(stopAfter(w, before, at(w))).toBe('The party arrives.');
    expect(stopAfter(w, before, target)).toBe('The party can get no closer.');
  });
});
