import { describe, expect, it } from 'vitest';
import { playedTonight, playForLodging } from '../../../src/game/world/perform.ts';
import { pray, prayedToday, shrineHere } from '../../../src/game/world/prayer.ts';
import { sellPrice } from '../../../src/game/world/shop.ts';
import { haggler, tradePercent } from '../../../src/game/world/trade.ts';
import type { Member } from '../../../src/game/world/types.ts';
import { tradeText } from '../../../src/render/town-view.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng, scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from './helpers.ts';
import { priceHere } from '../../../src/game/world/town-prices.ts';

/** Gives a member these skills with Int, Wis, and Cha at 10, so a check adds only the skill. */
function plain(m: Member, skills: Record<string, number>): void {
  const a = m.character.attributes;
  m.character = {
    ...m.character,
    skills: { ...m.character.skills, ...skills },
    attributes: {
      base: { ...a.base, int: 10, wis: 10, cha: 10 },
      people: {},
      background: {},
      advancement: {},
    },
  };
}

const EASTMARCH = { col: 20, row: 8 };

describe('Trade (docs/rules-adaptation.md, Skills)', () => {
  it('lets the best living trader haggle prices down and sales up, to at most 20%', () => {
    const w = world();
    expect(haggler(w, data)).toBeNull();
    expect(tradePercent(w, data)).toBe(0);
    expect(tradeText(w, data)).toBeNull();
    expect(priceHere(w, data, 100)).toBe(100);
    const crowbar = { id: 'crowbar', quantity: 1, location: 'stowed' as const };
    expect(sellPrice(w, data, crowbar)).toBe(2);
    plain(member(w, 'Snag'), { trade: 0 });
    plain(member(w, 'Grukk'), { trade: 2 });
    expect(haggler(w, data)).toMatchObject({
      member: { character: { name: 'Grukk' } },
      percent: 15,
    });
    expect(priceHere(w, data, 100)).toBe(85);
    expect(sellPrice(w, data, crowbar)).toBe(2.3);
    expect(tradeText(w, data)).toBe('Grukk haggles: prices 15% lower, gear sells for 15% more');
    // The dead don't haggle.
    member(w, 'Grukk').dead = true;
    expect(tradePercent(w, data)).toBe(5);
    plain(member(w, 'Lirael'), { trade: 4 });
    expect(tradePercent(w, data)).toBe(20);
  });
});

describe('Perform (docs/rules-adaptation.md, Skills)', () => {
  it('refuses mid-encounter, with no performer, or twice a night, and costs nothing to fail', () => {
    const w = world();
    plain(member(w, 'Snag'), { perform: 0 });
    w.encounter = encounter([['thug-or-militia']]);
    expect(playForLodging(w, data, member(w, 'Snag').id)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
    w.encounter = null;
    expect(playForLodging(w, data, 'nobody')).toEqual({
      ok: false,
      reason: 'Choose someone to play.',
    });
    const purse = w.purse;
    w.rng = scriptedRng([1, 1]);
    expect(playForLodging(w, data, member(w, 'Snag').id)).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('Snag plays to a cold room. The inn still wants paying.');
    expect(w.purse).toBe(purse);
    expect(w.day).toBe(0);
    expect(playedTonight(w)).toBe(true);
    expect(playForLodging(w, data, member(w, 'Snag').id)).toEqual({
      ok: false,
      reason: 'The common room has had its show tonight.',
    });
    w.position = { col: 5, row: 9 };
    expect(() => playForLodging(w, data, member(w, 'Snag').id)).toThrow('not in a town');
  });

  it('pays the night at the inn on a success, and tips on a great one', () => {
    const w = world();
    const snag = member(w, 'Snag');
    plain(snag, { perform: 1 });
    const purse = w.purse;
    // 3 + 4 + 1 = 8 meets Rubblegate's 8 exactly: no tips.
    w.rng = scriptedThen([3, 4], createRng('show'));
    expect(playForLodging(w, data, snag.id)).toEqual({ ok: true });
    expect(w.day).toBe(1);
    expect(w.purse).toBe(purse);
    expect(w.log.join('\n')).toContain(
      'Snag plays the common room, and the inn gives the party its beds for the night.',
    );
    expect(playedTonight(w)).toBe(false);
    // 5 + 5 + 1 = 11 beats 8 by 3: a d6 of tips.
    w.rng = scriptedThen([5, 5, 4], createRng('encore'));
    playForLodging(w, data, snag.id);
    expect(w.purse).toBe(purse + 4);
    expect(w.log.join('\n')).toContain('The crowd throws 4 crowns in tips.');
  });
});

describe('Prayer (docs/rules-adaptation.md, Skills)', () => {
  it('is heard at a temple or mortuary, never a crypt, once a day each', () => {
    const w = world();
    const [snag, grukk, lirael, fizz] = ['Snag', 'Grukk', 'Lirael', 'Fizzwick'].map((n) =>
      member(w, n),
    ) as [Member, Member, Member, Member];
    for (const m of [snag, lirael, fizz]) plain(m, { pray: 1 });
    // Rubblegate has only Ysolde's crypt.
    expect(shrineHere(w, data)).toBeUndefined();
    expect(pray(w, data, snag.id, { kind: 'strain' })).toEqual({
      ok: false,
      reason: 'Rubblegate has no temple or mortuary.',
    });
    w.position = EASTMARCH;
    expect(shrineHere(w, data)?.name).toBe('Brother Aldo');
    w.encounter = encounter([['thug-or-militia']]);
    expect(pray(w, data, snag.id, { kind: 'strain' }).ok).toBe(false);
    w.encounter = null;
    expect(pray(w, data, 'nobody', { kind: 'strain' })).toEqual({
      ok: false,
      reason: 'Choose someone to pray.',
    });
    expect(pray(w, data, snag.id, { kind: 'strain' })).toEqual({
      ok: false,
      reason: 'Snag has no strain to ease.',
    });
    expect(pray(w, data, snag.id, { kind: 'frailty', target: grukk.id })).toEqual({
      ok: false,
      reason: 'Choose someone who is Frail.',
    });
    snag.character = { ...snag.character, strain: { value: 2, broken: false } };
    w.rng = scriptedRng([4, 3]);
    expect(pray(w, data, snag.id, { kind: 'strain' })).toEqual({ ok: true });
    expect(snag.character.strain.value).toBe(1);
    expect(w.log.at(-1)).toContain(
      "Snag prays at Brother Aldo's mortuary and feels the strain ease.",
    );
    expect(prayedToday(w, snag)).toBe(true);
    expect(pray(w, data, snag.id, { kind: 'strain' })).toEqual({
      ok: false,
      reason: 'Snag has already prayed today.',
    });
    grukk.frail = true;
    w.rng = scriptedRng([1, 1]);
    expect(pray(w, data, lirael.id, { kind: 'frailty', target: grukk.id })).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain("Lirael prays at Brother Aldo's mortuary, but no answer comes.");
    expect(grukk.frail).toBe(true);
    w.rng = scriptedRng([6, 6]);
    pray(w, data, fizz.id, { kind: 'frailty', target: grukk.id });
    expect(grukk.frail).toBe(false);
    expect(w.log.at(-1)).toContain("and Grukk's Frailty lifts.");
    w.day += 1;
    expect(prayedToday(w, snag)).toBe(false);
  });
});

describe('town skills by town size, and the sleeping', () => {
  it('plays a village for 7 and 1d4 of tips', () => {
    const w = world();
    w.position = { col: 17, row: 4 };
    const snag = member(w, 'Snag');
    plain(snag, { perform: 0 });
    const purse = w.purse;
    // 5 + 5 + 0 = 10 beats a village's 7 by 3.
    w.rng = scriptedThen([5, 5, 3], createRng('village'));
    playForLodging(w, data, snag.id);
    expect(w.purse).toBe(purse + 3);
  });

  it('turns away a member asleep after a revive', () => {
    const w = world();
    const snag = member(w, 'Snag');
    snag.reviving = true;
    expect(playForLodging(w, data, snag.id).ok).toBe(false);
    w.position = EASTMARCH;
    expect(pray(w, data, snag.id, { kind: 'strain' })).toEqual({
      ok: false,
      reason: 'Choose someone to pray.',
    });
  });
});
