import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/data/schemas/index.ts';
import { resolveAttack, shockContext } from '../../../src/game/combat/attack.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { harm } from '../../../src/game/combat/damage.ts';
import { freeActions } from '../../../src/game/combat/free-actions.ts';
import type { Attack, Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { counterAttack, hurl, vowedTurn } from '../../../src/game/combat/vowed.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { vowed } from '../vowed.ts';
import { data, starter, who } from './helpers.ts';

const AUTOMATIC = ['martial-style', 'unarmed-might', 'unarmored-defense'];

function battle(arts: string[], enemies: string[][] = [['thug-or-militia', 'thug-or-militia']]) {
  const monk: Character = { ...vowed([...AUTOMATIC, ...arts], 3), name: 'Monk' };
  return createBattle({
    data,
    rng: createRng('vowed'),
    party: [
      { character: monk, row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
    ],
    enemies,
    log: true,
  });
}

const monkOf = (b: Battle) => who(b, 'Monk');
const casterOf = (c: Combatant) => c.caster as CasterState;
const foe = (b: Battle) => who(b, 'foe-0-0');
const melee = (c: Combatant) => c.attacks.find((a) => a.mode === 'melee') as Attack;

/** Effort to spend: `max` in all, none used. */
function effort(c: Combatant, max: number): void {
  Object.assign(casterOf(c), { effortMax: max, effortUsed: 0, effortDay: 0 });
}

describe('Brutal Counter (1.5.17)', () => {
  it('strikes back after a melee attack for Effort for the scene', () => {
    const b = battle(['brutal-counter']);
    const m = monkOf(b);
    effort(m, 2);
    const log = b.log as string[];
    const before = log.length;
    resolveAttack(b, foe(b), melee(foe(b)), m);
    expect(casterOf(m).effortUsed).toBe(1);
    expect(casterOf(m).effortDay).toBe(0);
    expect(log.slice(before).join(' ')).toContain('answers');
  });

  it('holds back for ranged attacks, allies, a downed Vowed, and no art or Effort', () => {
    const b = battle(['brutal-counter']);
    const m = monkOf(b);
    effort(m, 1);
    const f = foe(b);
    expect(counterAttack(b, f, { ...melee(f), mode: 'ranged' }, m)).toBeNull();
    expect(counterAttack(b, who(b, 'Grukk'), melee(f), m)).toBeNull();
    m.status = 'dying';
    expect(counterAttack(b, f, melee(f), m)).toBeNull();
    m.status = 'active';
    f.status = 'dead';
    expect(counterAttack(b, f, melee(f), m)).toBeNull();
    f.status = 'active';
    // No melee attack that reaches.
    const fists = m.attacks;
    m.attacks = [];
    expect(counterAttack(b, f, melee(f), m)).toBeNull();
    m.attacks = fists;
    expect(counterAttack(b, f, melee(f), m)).not.toBeNull();
    expect(counterAttack(b, f, melee(f), m)).toBeNull();
  });

  it('keeps the Effort Revivifying Breath needs until it is used this scene', () => {
    const b = battle(['brutal-counter', 'revivifying-breath']);
    const m = monkOf(b);
    effort(m, 1);
    const f = foe(b);
    expect(counterAttack(b, f, melee(f), m)).toBeNull();
    casterOf(m).usedThisScene.add('revivifying-breath');
    expect(counterAttack(b, f, melee(f), m)).not.toBeNull();
  });
});

describe('Hurling Throw (1.5.17)', () => {
  it('stuns a target that fails its Physical save, once a round each', () => {
    const b = battle(['hurling-throw']);
    const m = monkOf(b);
    effort(m, 3);
    const f = foe(b);
    b.rng = scriptedThen([1], createRng('x'));
    hurl(b, m, f);
    expect(f.stunned).toBe(true);
    expect(casterOf(m).effortUsed).toBe(1);
    f.stunned = false;
    hurl(b, m, f);
    expect(casterOf(m).effortUsed).toBe(1);
    b.round += 1;
    b.rng = scriptedThen([20], createRng('x'));
    hurl(b, m, f);
    expect(f.stunned).toBe(false);
    expect(casterOf(m).effortUsed).toBe(2);
  });

  it('skips the large, the fallen, those without the art, and a spent Vowed', () => {
    const b = battle(['hurling-throw'], [['large-solitary-predator']]);
    const m = monkOf(b);
    effort(m, 1);
    const f = foe(b);
    hurl(b, m, f);
    hurl(b, f, m);
    f.tags.delete('large');
    f.status = 'dead';
    hurl(b, m, f);
    f.status = 'active';
    casterOf(m).effortUsed = 1;
    hurl(b, m, f);
    expect(f.stunned).toBe(false);
    expect(casterOf(m).usedThisScene.size).toBe(0);
  });

  it('follows a hit', () => {
    const b = battle(['hurling-throw']);
    const m = monkOf(b);
    effort(m, 1);
    const f = foe(b);
    f.hp = 100;
    f.maxHp = 100;
    // A natural 20 hits, then the damage and the failed save.
    b.rng = scriptedThen([20, 1, 1], createRng('x'));
    resolveAttack(b, m, melee(m), f);
    expect(casterOf(m).effortUsed).toBe(1);
  });
});

describe('Mob Justice (1.5.17)', () => {
  it('commits Effort for the day against two melee foes and ends while fewer press', () => {
    const b = battle(['mob-justice']);
    const m = monkOf(b);
    effort(m, 2);
    vowedTurn(b, m);
    expect(m.mobJustice).toBe(true);
    expect(casterOf(m).effortDay).toBe(1);
    expect(shockContext(m, melee(foe(b))).immune).toBe(true);
    who(b, 'foe-0-1').status = 'dead';
    vowedTurn(b, m);
    expect(m.mobJustice).toBe(false);
    who(b, 'foe-0-1').status = 'active';
    vowedTurn(b, m);
    expect(m.mobJustice).toBe(true);
    expect(casterOf(m).effortDay).toBe(1);
  });

  it('needs the front row and the art', () => {
    const b = battle(['mob-justice']);
    const m = monkOf(b);
    effort(m, 2);
    m.row = 1;
    vowedTurn(b, m);
    expect(m.mobJustice).toBe(false);
    const plain = battle([]);
    vowedTurn(plain, monkOf(plain));
    expect(monkOf(plain).mobJustice).toBe(false);
  });

  it('runs On Turn with the other free actions', () => {
    const b = battle(['mob-justice']);
    const m = monkOf(b);
    effort(m, 2);
    freeActions(b, m);
    expect(m.mobJustice).toBe(true);
  });
});

describe('Revivifying Breath (1.5.17)', () => {
  it('heals 1d6 plus the level at half hit points, once a scene, for Effort for the day', () => {
    const b = battle(['revivifying-breath'], [['thug-or-militia']]);
    const m = monkOf(b);
    effort(m, 2);
    m.maxHp = 20;
    m.hp = 11;
    vowedTurn(b, m);
    expect(m.hp).toBe(11);
    m.hp = 10;
    b.rng = scriptedThen([4], createRng('x'));
    vowedTurn(b, m);
    expect(m.hp).toBe(17);
    expect(casterOf(m).effortDay).toBe(1);
    m.hp = 2;
    vowedTurn(b, m);
    expect(m.hp).toBe(2);
  });

  it('raises a falling Vowed for all their Effort left', () => {
    const b = battle(['revivifying-breath'], [['thug-or-militia']]);
    const m = monkOf(b);
    effort(m, 3);
    casterOf(m).effortUsed = 1;
    m.hp = 1;
    b.rng = scriptedThen([2], createRng('x'));
    harm(b, m, 5);
    expect(m.status).toBe('active');
    expect(m.hp).toBe(5);
    expect(casterOf(m)).toMatchObject({ effortUsed: 3, effortDay: 2 });
    // Used this scene: the next fall is a fall.
    harm(b, m, 10);
    expect(m.status).toBe('dying');
  });

  it('fails with no Effort left or in armor', () => {
    const b = battle(['revivifying-breath'], [['thug-or-militia']]);
    const m = monkOf(b);
    effort(m, 1);
    casterOf(m).effortUsed = 1;
    harm(b, m, m.hp);
    expect(m.status).toBe('dying');
    const armored = battle(['revivifying-breath'], [['thug-or-militia']]);
    const a = monkOf(armored);
    effort(a, 1);
    casterOf(a).canCast = false;
    harm(armored, a, a.hp);
    expect(a.status).toBe('dying');
  });
});

describe('The Inward Eye (1.5.17)', () => {
  it('lets the Vowed see in a dark fight for committed Effort', () => {
    const b = battle(['the-inward-eye']);
    const m = monkOf(b);
    effort(m, 2);
    b.dark = true;
    freeActions(b, m);
    expect(m.seesInDark).toBe(true);
    expect(casterOf(m).effortUsed).toBe(1);
  });
});
