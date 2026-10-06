import { describe, expect, it } from 'vitest';
import { gameSpells } from '../../../src/data/spells.ts';
import { learnableSpells } from '../../../src/game/character/magic.ts';
import { classOption } from '../../../src/game/character/class-step.ts';
import { enterTown } from '../../../src/game/world/town.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import {
  castersOf,
  HIGH_ROAD,
  highRoads,
  openHighRoad,
  SIGIL,
  sigilEscape,
} from '../../../src/game/world/waygates.ts';
import { distance, hexKey } from '../../../src/rules/hex.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { regionMap } from '../../../src/game/world/region.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { below } from '../dungeon/helpers.ts';
import { data, encounter, member, world } from './helpers.ts';

const regionMapOf = (w: World) => regionMap(data, w.region);

/** Fizzwick as a ninth-level High Mage with both travel spells prepared. */
function wayfarer(w: World): Member {
  const f = member(w, 'Fizzwick');
  f.character = {
    ...f.character,
    classes: { current: 'full-high-mage', levels: { 'full-high-mage': 9 } },
    spells: { known: [SIGIL, HIGH_ROAD], prepared: [SIGIL, HIGH_ROAD] },
  };
  return f;
}

/** A party back in Westhold that has been to Eastmarch and Highcairn. */
function travelled(): World {
  const w = world();
  w.rng = createRng('roads');
  for (const id of ['eastmarch', 'highcairn', 'westhold']) {
    const site = data.content.regions[0]?.sites.find((s) => s.id === id);
    w.position = { col: site?.col ?? 0, row: site?.row ?? 0 };
    enterTown(w, data, id);
  }
  return w;
}

describe('High Magic travel spells (Sam’s calls)', () => {
  it('can be learned, while the nine left out for good can’t', () => {
    const mage = classOption(data, 'full-high-mage')?.mage;
    const ids = learnableSpells(data, mage as NonNullable<typeof mage>, 9).map((s) => s.id);
    expect(ids).toEqual(expect.arrayContaining([SIGIL, HIGH_ROAD]));
    for (const id of data.content.spellRules.excluded) expect(ids).not.toContain(id);
    expect(gameSpells(data.srd, data.content).some((s) => s.id === 'the-earth-as-clay')).toBe(true);
  });

  it('The Ochre Sigil: out of the dungeon onto its hex, for a spell', () => {
    const w = below();
    const f = wayfarer(w);
    const at = { ...w.position };
    expect(castersOf(w, SIGIL)).toEqual([f]);
    expect(sigilEscape(w, data, f.id)).toEqual({ ok: true });
    expect([w.dungeon, w.light.lit, f.spellsCast, w.position]).toEqual([null, null, 1, at]);
    expect(w.log.at(-1)).toContain('Fizzwick speaks the sigil');
    expect(sigilEscape(w, data, f.id)).toEqual({
      ok: false,
      reason: 'The party is not in a dungeon.',
    });
  });

  it('The Ochre Sigil needs the spell, a slot, and no encounter', () => {
    const w = below();
    expect(sigilEscape(w, data, member(w, 'Snag').id)).toEqual({
      ok: false,
      reason: "Snag hasn't prepared The Ochre Sigil of Juxtaposition.",
    });
    const f = wayfarer(w);
    f.spellsCast = 99;
    expect(sigilEscape(w, data, f.id)).toMatchObject({ ok: false });
    w.encounter = encounter([['thug-or-militia']]);
    expect(sigilEscape(w, data, f.id)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    expect(w.dungeon).not.toBeNull();
  });

  it('Open the High Road: to a visited town in the region, not the one the party is in', () => {
    const w = travelled();
    const f = wayfarer(w);
    expect(highRoads(w, data).map((s) => s.id)).toEqual(['eastmarch', 'highcairn']);
    w.destination = { col: 9, row: 9 };
    w.rng = scriptedThen([2], createRng('road'));
    expect(openHighRoad(w, data, f.id, 'eastmarch')).toEqual({ ok: true });
    expect([w.position, w.lastTown, w.destination, f.spellsCast]).toEqual([
      { col: 20, row: 8 },
      'eastmarch',
      null,
      1,
    ]);
    expect(w.log.slice(-2)).toEqual([
      'Day 1, morning: Fizzwick opens the High Road toward Scrapmarch.',
      'Day 1, morning: The party reaches Scrapmarch.',
    ]);
  });

  it('Open the High Road strays one time in ten, onto open ground near the town', () => {
    const w = travelled();
    const f = wayfarer(w);
    w.rng = scriptedThen([1, 0], createRng('stray'));
    expect(openHighRoad(w, data, f.id, 'highcairn')).toEqual({ ok: true });
    const d = distance(w.position, { col: 17, row: 4 });
    expect(regionMapOf(w).siteAt(w.position)).toBeUndefined();
    expect(d >= 1 && d <= 3).toBe(true);
    expect([w.lastTown, w.visited.has(hexKey(w.position))]).toEqual(['westhold', true]);
    expect(w.log).toContainEqual(expect.stringContaining('The road opens astray'));
    // A grove standing where it would have landed turns it aside.
    const grove = { ...(data.content.groves[0] as (typeof data.content.groves)[number]) };
    const wooded = { ...data, content: { ...data.content, groves: [{ ...grove, ...w.position }] } };
    const v = travelled();
    v.rng = scriptedThen([1, 0], createRng('stray'));
    openHighRoad(v, wooded, wayfarer(v).id, 'highcairn');
    expect(hexKey(v.position)).not.toBe(hexKey(w.position));
    // With groves all around, there is nowhere else to land but the town.
    const ring = [];
    for (let col = 14; col <= 20; col++)
      for (let row = 1; row <= 7; row++) ring.push({ ...grove, id: `g-${col}-${row}`, col, row });
    const thicket = { ...data, content: { ...data.content, groves: ring } };
    const t = travelled();
    t.rng = scriptedThen([1], createRng('thicket'));
    openHighRoad(t, thicket, wayfarer(t).id, 'highcairn');
    expect([t.position, t.lastTown]).toEqual([{ col: 17, row: 4 }, 'highcairn']);
  });

  it('Open the High Road refuses underground, mid-encounter, on a coach, or to strange towns', () => {
    const w = travelled();
    const f = wayfarer(w);
    expect(openHighRoad(w, data, f.id, 'cinderhold')).toEqual({
      ok: false,
      reason: 'The party knows no such town to open the road to.',
    });
    expect(openHighRoad(w, data, member(w, 'Snag').id, 'eastmarch')).toMatchObject({ ok: false });
    w.coach = {} as World['coach'];
    expect(openHighRoad(w, data, f.id, 'eastmarch')).toEqual({
      ok: false,
      reason: 'The party is on a coach.',
    });
    w.encounter = encounter([['thug-or-militia']]);
    expect(openHighRoad(w, data, f.id, 'eastmarch')).toMatchObject({ ok: false });
    expect(openHighRoad(below(), data, f.id, 'eastmarch')).toEqual({
      ok: false,
      reason: 'The High Road opens only under the sky.',
    });
    expect(f.spellsCast).toBe(0);
  });
});
