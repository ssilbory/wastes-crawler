import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/data/schemas/index.ts';
import {
  awaitsMending,
  awaitsRescue,
  castRescue,
  concludeBattle,
  dyingOf,
  firstRescue,
  mendings,
  rescues,
  tendDying,
  tendRound,
  woundedOf,
  type Rescue,
} from '../../../src/game/combat/aftermath.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import type { Battle, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';
import { finishMending } from '../../../src/game/combat/aftermath.ts';

/** A won fight: every foe dead. */
function won(b: Battle): Battle {
  for (const c of b.combatants.filter((x) => x.side === 'enemy')) c.status = 'dead';
  b.outcome = 'party';
  return b;
}

const fall = (c: Combatant, round: number) =>
  Object.assign(c, { status: 'dying', fellRound: round });

/** A medic whose Heal check adds exactly `bonus`, with or without a healer's kit. */
const medic = (c: Combatant, bonus: number, kit = false) =>
  Object.assign(c, { skills: { ...c.skills, heal: bonus }, healModifier: 0, hasHealKit: kit });

describe('tending the dying after a win (SRD 2.5.1, 2.3.3)', () => {
  it('gives each victim the best free medic, falling first first', () => {
    const b = won(standardBattle([['thug-or-militia']]));
    b.round = 2;
    const [snag, grukk, lirael, fizz] = ['Snag', 'Grukk', 'Lirael', 'Fizzwick'].map((n) =>
      who(b, n),
    ) as [Combatant, Combatant, Combatant, Combatant];
    fall(snag, 2);
    fall(grukk, 1);
    medic(lirael, 2, true);
    medic(fizz, 1);
    expect(dyingOf(b).map((c) => c.name)).toEqual(['Grukk', 'Snag']);
    // Grukk (fell first) gets Lirael: 4 + 4 + 2 against 8 + 1 = 9. Snag gets Fizzwick: 3 + 3 + 1
    // against 8 + 0 + 2 = 10. No one is left to aid.
    b.rng = scriptedRng([4, 4, 3, 3]);
    tendRound(b);
    expect(grukk.status).toBe('stable');
    expect(snag.status).toBe('dying');
    expect(b.round).toBe(3);
  });

  it('lets the medics left over aid, for +1 at most', () => {
    const b = won(standardBattle([['thug-or-militia']]));
    b.round = 1;
    const [snag, grukk, lirael, fizz] = ['Snag', 'Grukk', 'Lirael', 'Fizzwick'].map((n) =>
      who(b, n),
    ) as [Combatant, Combatant, Combatant, Combatant];
    fall(snag, 1);
    medic(lirael, 2, true);
    medic(fizz, 1, true);
    medic(grukk, 0, true);
    // Fizzwick fails to aid (1 + 1 + 1 against 8), Grukk succeeds (4 + 4 + 0), then Lirael rolls
    // 2 + 3 + 2 + 1 = 8, just enough.
    b.rng = scriptedRng([1, 1, 4, 4, 2, 3]);
    tendRound(b);
    expect(snag.status).toBe('stable');
    expect(b.log?.join('\n')).toContain('Grukk helps Lirael tend Snag.');
  });

  it('rolls a Broken medic and helper at a disadvantage (docs/rules-adaptation.md, Broken)', () => {
    const b = won(standardBattle([['thug-or-militia']]));
    b.round = 1;
    const [snag, grukk, lirael, fizz] = ['Snag', 'Grukk', 'Lirael', 'Fizzwick'].map((n) =>
      who(b, n),
    ) as [Combatant, Combatant, Combatant, Combatant];
    fall(snag, 1);
    medic(lirael, 2, true);
    medic(grukk, 0, true);
    fizz.status = 'out';
    for (const c of [grukk, lirael]) c.strain = { strain: 0, max: 10, broken: true };
    // Each rolls three dice and keeps the lowest two: Grukk aids with 1 + 4 against 8, and
    // Lirael tends with 1 + 4 + 2 against 8. Both would have made it on 4 + 4.
    const rng = scriptedRng([4, 4, 1, 4, 4, 1]);
    b.rng = rng;
    tendRound(b);
    expect(snag.status).toBe('dying');
    expect(rng.remaining()).toBe(0);
  });

  it('keeps going until the dying live or die, with no one to ask', () => {
    const b = won(standardBattle([['thug-or-militia']]));
    const snag = fall(who(b, 'Snag'), b.round);
    for (const c of b.combatants.filter((x) => x.side === 'party' && x !== snag)) c.status = 'out';
    b.rng = scriptedRng([]);
    const r = concludeBattle(b);
    expect(snag.status).toBe('dead');
    expect(r).toMatchObject({ outcome: 'party', deaths: 1 });
    expect(awaitsRescue(b)).toBe(false);
  });
});

/** Snag, armored, as a Priest of Death with Healing Touch (as in healer.test.ts). */
function priest(): Character {
  const snag = starter('snag');
  return {
    ...snag,
    classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 1 } },
    skills: { ...snag.skills, heal: 1 },
    arts: ['healing-touch'],
    spells: { known: [], prepared: [] },
  };
}

function priestBattle(): Battle {
  return won(
    createBattle({
      data,
      rng: createRng('aftermath'),
      party: [
        { character: priest(), row: 0, column: 0 },
        { character: starter('grukk'), row: 0, column: 1 },
      ],
      enemies: [['thug-or-militia']],
      log: true,
    }),
  );
}

describe('healing the wounded after a fight (Sam’s call)', () => {
  it('waits only while someone is hurt, no one is dying, and healing can reach them', () => {
    const b = priestBattle();
    expect([woundedOf(b), mendings(b), awaitsMending(b)]).toEqual([[], [], false]);
    const grukk = who(b, 'Grukk');
    grukk.hp = grukk.maxHp - 3;
    expect(woundedOf(b)).toEqual([grukk]);
    expect(mendings(b).map((r) => r.label)).toEqual(['Snag: Healing Touch on Grukk']);
    expect(awaitsMending(b)).toBe(true);
    // The dying come first.
    const snag = fall(who(b, 'Snag'), b.round);
    expect(awaitsMending(b)).toBe(false);
    Object.assign(snag, { status: 'active', hp: 5 });
    castRescue(b, mendings(b).find((r) => r.target === grukk.id) as Rescue);
    expect(grukk.hp).toBeGreaterThan(grukk.maxHp - 3);
    // Done healing, the fight can end.
    grukk.hp = 1;
    b.mended = true;
    expect(awaitsMending(b)).toBe(false);
  });
});

describe('healing magic for the dying', () => {
  it('offers Healing Touch, and waits for the player while it can save someone', () => {
    const b = priestBattle();
    expect(rescues(b)).toEqual([]);
    expect(awaitsRescue(b)).toBe(false);
    const grukk = fall(who(b, 'Grukk'), b.round);
    const touch: Rescue = {
      caster: who(b, 'Snag').id,
      magic: 'healing-touch',
      target: grukk.id,
      label: 'Snag: Healing Touch on Grukk',
    };
    expect(rescues(b)).toEqual([touch]);
    expect(awaitsRescue(b)).toBe(true);
    castRescue(b, { ...touch, caster: 'nobody' });
    expect(grukk.status).toBe('dying');
    castRescue(b, touch);
    expect(grukk.status).toBe('active');
    expect(grukk.hp).toBeGreaterThan(0);
  });

  it('asks each round, and keeps up the Heal checks when the answer is no', () => {
    const b = priestBattle();
    const grukk = fall(who(b, 'Grukk'), b.round);
    let asked = 0;
    tendDying(b, (options) => {
      asked += 1;
      expect(options).toHaveLength(1);
      return null;
    });
    expect(asked).toBeGreaterThan(0);
    expect(['stable', 'dead']).toContain(grukk.status);
  });

  it('uses the first healing on offer when no one is asked', () => {
    expect(firstRescue([])).toBeNull();
    const b = priestBattle();
    const grukk = fall(who(b, 'Grukk'), b.round);
    expect(concludeBattle(b).deaths).toBe(0);
    expect(grukk.status).toBe('active');
  });
});

describe('finishMending', () => {
  it('sets the mended flag the healing pause waits on', () => {
    const b = standardBattle([['thug-or-militia']]);
    expect(b.mended).toBe(false);
    finishMending(b);
    expect(b.mended).toBe(true);
  });
});
