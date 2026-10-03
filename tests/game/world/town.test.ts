import { describe, expect, it } from 'vitest';
import {
  cureFrail,
  healListed,
  innListed,
  raiseDead,
  raiseListed,
  stayAtInn,
  templeHeal,
} from '../../../src/game/world/services.ts';
import {
  currentTown,
  enterTown,
  ledger,
  priceHere,
  spend,
  townHere,
} from '../../../src/game/world/town.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

const westhold = () => {
  const w = world();
  w.purse = 1000;
  return w;
};

describe('town ledgers (docs/rules-adaptation.md, Progression and economy)', () => {
  it('knows the town the party is in', () => {
    const w = world();
    expect(currentTown(w, data)?.id).toBe('westhold');
    expect(w.towns).toEqual({ westhold: { spent: 0, looted: 0, since: 0 } });
    w.position = { col: 5, row: 9 };
    expect(currentTown(w, data)).toBeUndefined();
    expect(() => townHere(w, data)).toThrow('the party is not in a town');
  });

  it('charges listed prices until the threshold, then more', () => {
    const w = westhold();
    expect(priceHere(w, data, 100)).toBe(100);
    w.towns.westhold = { spent: 1500, looted: 0, since: 0 };
    expect(priceHere(w, data, 300)).toBe(315);
  });

  it('pays from the purse and records the listed spending, or refuses', () => {
    const w = westhold();
    expect(spend(w, data, 100)).toBe(true);
    expect(w.purse).toBe(900);
    expect(w.towns.westhold?.spent).toBe(100);
    expect(spend(w, data, 901)).toBe(false);
    expect(w.purse).toBe(900);
  });

  it('resets a ledger a month after it opened', () => {
    const w = westhold();
    w.towns.westhold = { spent: 1400, looted: 50, since: 0 };
    w.day = 29;
    expect(ledger(w, data, townHere(w, data)).spent).toBe(1400);
    w.day = 30;
    expect(ledger(w, data, townHere(w, data))).toEqual({ spent: 0, looted: 0, since: 30 });
  });
});

describe('arriving in a town', () => {
  it('moves the purse with the economic climate on a first visit', () => {
    const w = westhold();
    w.rng = scriptedRng([10]);
    w.position = { col: 20, row: 8 };
    enterTown(w, data, 'eastmarch');
    expect(w).toMatchObject({ purse: 1100, lastTown: 'eastmarch', climateDay: 0 });
    expect(w.log.slice(-2)).toEqual([
      'Day 1, morning: The party reaches Eastmarch.',
      'Day 1, morning: The economic climate moves the purse up 10%.',
    ]);
    w.rng = scriptedRng([-30]);
    w.day = 31;
    enterTown(w, data, 'westhold');
    expect(w.purse).toBe(770);
    expect(w.log.at(-1)).toContain('down 30%');
  });

  it('rolls no climate on a return within a month, and changes nothing on 0% or an empty purse', () => {
    const w = westhold();
    enterTown(w, data, 'westhold');
    expect(w.purse).toBe(1000);
    w.rng = scriptedRng([0]);
    enterTown(w, data, 'eastmarch');
    expect(w.purse).toBe(1000);
    w.purse = 0;
    w.rng = scriptedRng([25]);
    enterTown(w, data, 'highcairn');
    expect(w.purse).toBe(0);
    expect(w.log.at(-1)).toContain('reaches Highcairn');
    expect(() => enterTown(w, data, 'atlantis')).toThrow('unknown town atlantis');
  });
});

describe('the inn', () => {
  it('charges each living PC, then rests everyone until morning', () => {
    const w = westhold();
    w.quarter = 2;
    w.rations = 4;
    member(w, 'Fizzwick').dead = true;
    const grukk = member(w, 'Grukk');
    grukk.character = {
      ...grukk.character,
      hp: { ...grukk.character.hp, current: 2 },
      strain: { value: 12, broken: true },
    };
    grukk.spellsCast = 1;
    expect(innListed(w, data)).toBe(9);
    expect(stayAtInn(w, data)).toEqual({ ok: true });
    expect(w).toMatchObject({ purse: 991, rations: 12, day: 1, quarter: 0, camp: 'none' });
    expect(grukk.character.strain).toEqual({ value: 0, broken: false });
    expect(grukk.character.hp.current).toBe(3);
    expect(grukk).toMatchObject({ hungry: false, sleepless: false, cold: false, spellsCast: 0 });
    expect(w.log.at(-1)).toBe('Day 2, morning: The party stays the night at the inn in Westhold.');
  });

  it('turns the party away without the crowns, or mid-encounter', () => {
    const w = world();
    w.purse = 11;
    expect(stayAtInn(w, data)).toEqual({ ok: false, reason: 'That costs 12 crowns.' });
    w.encounter = { enemies: [['thug-or-militia']], hostile: true, spotted: false, text: '' };
    expect(stayAtInn(w, data)).toEqual({ ok: false, reason: 'Settle the encounter first.' });
  });
});

describe('the temple', () => {
  it('heals to full for 10 crowns a hit point, adding 1 System Strain', () => {
    const w = westhold();
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, hp: { max: 8, current: 3 } };
    expect(healListed(data, snag)).toBe(50);
    expect(templeHeal(w, data, 'm-0')).toEqual({ ok: true });
    expect(snag.character.hp.current).toBe(8);
    expect(snag.character.strain.value).toBe(1);
    expect(w.purse).toBe(950);
    expect(templeHeal(w, data, 'm-0')).toEqual({ ok: false, reason: 'Snag is unhurt.' });
  });

  it('refuses the dead, the strained, and the poor', () => {
    const w = westhold();
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, hp: { max: 8, current: 3 } };
    snag.dead = true;
    expect(templeHeal(w, data, 'm-0')).toEqual({ ok: false, reason: 'Snag is dead.' });
    snag.dead = false;
    snag.character = { ...snag.character, strain: { value: 11, broken: false } };
    expect(templeHeal(w, data, 'm-0')).toEqual({
      ok: false,
      reason: "Snag can't bear more magical healing.",
    });
    snag.character = { ...snag.character, strain: { value: 0, broken: false } };
    w.purse = 10;
    expect(templeHeal(w, data, 'm-0')).toEqual({ ok: false, reason: 'That costs 50 crowns.' });
    expect(() => templeHeal(w, data, 'm-9')).toThrow('no party member m-9');
  });

  it('cures Frailty', () => {
    const w = westhold();
    const snag = member(w, 'Snag');
    expect(cureFrail(w, data, 'm-0')).toEqual({ ok: false, reason: "Snag isn't Frail." });
    snag.frail = true;
    expect(cureFrail(w, data, 'm-0')).toEqual({ ok: true });
    expect(snag.frail).toBe(false);
    expect(w.purse).toBe(900);
    snag.frail = true;
    w.purse = 99;
    expect(cureFrail(w, data, 'm-0')).toMatchObject({ ok: false });
  });

  it('raises the dead at 1 HP with the XP they missed', () => {
    const w = westhold();
    const snag = member(w, 'Snag');
    expect(raiseDead(w, data, 'm-0')).toEqual({ ok: false, reason: "Snag isn't dead." });
    Object.assign(snag, { dead: true, frail: true, pendingXp: 1.5 });
    snag.character = { ...snag.character, strain: { value: 22, broken: true } };
    expect(raiseListed(data, snag)).toBe(250);
    w.purse = 249;
    expect(raiseDead(w, data, 'm-0')).toMatchObject({ ok: false });
    w.purse = 250;
    expect(raiseDead(w, data, 'm-0')).toEqual({ ok: true });
    expect(snag).toMatchObject({ dead: false, frail: false, pendingXp: 0 });
    expect(snag.character).toMatchObject({ xp: 1.5, hp: { current: 1 }, strain: { value: 0 } });
    expect(w.purse).toBe(0);
  });
});
