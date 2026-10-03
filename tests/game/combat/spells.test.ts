import { describe, expect, it } from 'vitest';
import { canUse, castMagic, combatMagic } from '../../../src/game/combat/spells.ts';
import type { Battle, CasterState } from '../../../src/game/combat/types.ts';
import type { CombatMagic } from '../../../src/data/schemas/index.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, who } from './helpers.ts';

function setup(enemies: string[][], faces: number[] = []) {
  const b = standardBattle(enemies);
  b.rng = scriptedRng(faces);
  const fizz = who(b, 'Fizzwick');
  return { b, fizz, caster: fizz.caster as CasterState };
}
const m = (b: Battle, id: string) => combatMagic(b, id) as CombatMagic;

describe('spells', () => {
  it('casts The Coruscating Coffin: 1d8 per level, Physical save for half', () => {
    // 1d8 = 6; the veteran fails its save (5 against 14).
    const { b, fizz, caster } = setup([['skilled-veteran']], [6, 5]);
    const vet = who(b, 'foe-0-0');
    vet.hp = 20;
    expect(castMagic(b, fizz, 'the-coruscating-coffin', vet.id, undefined)).toBe(true);
    expect(vet.hp).toBe(14);
    expect(caster.spellsLeft).toBe(0);
    expect(castMagic(b, fizz, 'the-coruscating-coffin', vet.id, undefined)).toBe(false);
  });

  it('rerolls low damage with Empowered Sorcery and forces a reroll with Inexorable Effect', () => {
    // Damage 2 is below average, so Empowered Sorcery rerolls to 7; the save succeeds (16), then
    // Inexorable Effect forces a reroll that fails (3).
    const { b, fizz, caster } = setup([['skilled-veteran']], [2, 7, 16, 3]);
    const vet = who(b, 'foe-0-0');
    vet.hp = 20;
    castMagic(b, fizz, 'the-coruscating-coffin', vet.id, undefined);
    expect(vet.hp).toBe(13);
    expect(caster.effortUsed).toBe(2);
  });

  it('halves damage on a successful save and slays 1-HD foes outright', () => {
    const { b, fizz, caster } = setup([['skilled-veteran', 'thug-or-militia']], [8, 16]);
    caster.effortUsed = caster.effortMax;
    const vet = who(b, 'foe-0-0');
    vet.hp = 20;
    castMagic(b, fizz, 'the-coruscating-coffin', vet.id, undefined);
    expect(vet.hp).toBe(16);
    caster.spellsLeft = 1;
    b.rng = scriptedRng([1]);
    const thug = who(b, 'foe-0-1');
    castMagic(b, fizz, 'the-coruscating-coffin', thug.id, undefined);
    expect(thug.status).toBe('dead');
    caster.spellsLeft = 1;
    b.rng = scriptedRng([1]);
    expect(castMagic(b, fizz, 'the-coruscating-coffin', undefined, undefined)).toBe(true);
  });

  it('puts a row of living foes with 4 HD or fewer to sleep', () => {
    const { b, fizz } = setup([
      ['thug-or-militia', 'automaton-humanlike', 'warrior-baron'],
      ['thug-or-militia'],
    ]);
    castMagic(b, fizz, 'the-wind-of-the-final-repose', undefined, 0);
    expect(b.combatants.filter((c) => c.side === 'enemy').map((c) => c.status)).toEqual([
      'asleep',
      'active',
      'active',
      'active',
    ]);
  });

  it('blinds, wards, and enthralls', () => {
    const { b, fizz, caster } = setup([['skilled-veteran', 'skilled-veteran']], [5, 16, 2]);
    caster.effortUsed = caster.effortMax;
    caster.spellsLeft = 5;
    const [a, c] = [who(b, 'foe-0-0'), who(b, 'foe-0-1')];
    castMagic(b, fizz, 'damnation-of-the-sense', a.id, undefined);
    expect(a.blindRounds).toBe(Number.POSITIVE_INFINITY);
    castMagic(b, fizz, 'damnation-of-the-sense', c.id, undefined);
    expect(c.blindRounds).toBe(1);
    caster.prepared.push('wardpact-invocation', 'ineluctable-shackles-of-volition');
    const lirael = who(b, 'Lirael');
    castMagic(b, fizz, 'wardpact-invocation', lirael.id, undefined);
    expect(lirael.wardRounds).toBe(1);
    expect(canUse(b, fizz, m(b, 'wardpact-invocation'), false, lirael.id)).toBe(false);
    castMagic(b, fizz, 'ineluctable-shackles-of-volition', a.id, undefined);
    expect(a.status).toBe('out');
    caster.spellsLeft = 3;
    for (const id of [
      'damnation-of-the-sense',
      'wardpact-invocation',
      'ineluctable-shackles-of-volition',
    ]) {
      expect(castMagic(b, fizz, id, undefined, undefined)).toBe(true);
    }
  });

  it('casts from strain when out of slots, within the maximum and not while Broken', () => {
    const { b, fizz, caster } = setup([['skilled-veteran']], [4, 5]);
    caster.spellsLeft = 0;
    caster.effortUsed = caster.effortMax;
    const coffin = m(b, 'the-coruscating-coffin');
    expect(canUse(b, fizz, coffin)).toBe(false);
    expect(canUse(b, fizz, coffin, true)).toBe(true);
    castMagic(b, fizz, coffin.id, 'foe-0-0', undefined, true);
    expect(fizz.strain?.strain).toBe(1);
    fizz.strain = { strain: 11, max: 11, broken: false };
    expect(canUse(b, fizz, coffin, true)).toBe(false);
    fizz.strain = { strain: 0, max: 11, broken: true };
    expect(canUse(b, fizz, coffin, true)).toBe(false);
    fizz.strain = null;
    expect(canUse(b, fizz, coffin, true)).toBe(false);
  });

  it('refuses magic the caster can’t use', () => {
    const { b, fizz, caster } = setup([['thug-or-militia']]);
    expect(castMagic(b, fizz, 'fireball', undefined, undefined)).toBe(false);
    expect(canUse(b, who(b, 'Snag'), m(b, 'the-coruscating-coffin'))).toBe(false);
    expect(canUse(b, fizz, m(b, 'empowered-sorcery'))).toBe(false);
    expect(canUse(b, fizz, m(b, 'elemental-blast'))).toBe(false);
    caster.canCast = false;
    expect(canUse(b, fizz, m(b, 'the-coruscating-coffin'))).toBe(false);
  });
});

describe('arts', () => {
  function elementalist(faces: number[]) {
    const s = setup([['thug-or-militia', 'automaton-laborer'], ['veteran-soldier']], faces);
    s.caster.arts.push('elemental-blast', 'pavis-of-elements', 'stunning-shock');
    return s;
  }

  it('hurls Elemental Blast with Magic, the best of Int, Cha, or Dex, and the caster level', () => {
    // From the rear (covered target, attack from rear): d20 18, edge dice 1 and 1; hit; 1d6 = 4.
    const { b, fizz, caster } = elementalist([18, 1, 1, 4]);
    const thug = who(b, 'foe-1-0');
    thug.hp = 20;
    castMagic(b, fizz, 'elemental-blast', thug.id, undefined);
    expect(thug.hp).toBe(14);
    expect(caster.effortUsed).toBe(1);
    b.rng = scriptedRng([1, 1, 1]);
    castMagic(b, fizz, 'elemental-blast', thug.id, undefined);
    expect(thug.hp).toBe(14);
    caster.effortUsed = 0;
    expect(castMagic(b, fizz, 'elemental-blast', undefined, undefined)).toBe(true);
  });

  it('raises AC with Pavis and stuns metal-bearing foes once each per scene', () => {
    const { b, fizz } = elementalist([5, 18, 19]);
    castMagic(b, fizz, 'pavis-of-elements', fizz.id, undefined);
    expect(fizz.acBonus).toBe(4);
    const thug = who(b, 'foe-0-0');
    castMagic(b, fizz, 'stunning-shock', thug.id, undefined);
    expect(thug.stunned).toBe(true);
    expect(canUse(b, fizz, m(b, 'stunning-shock'), false, thug.id)).toBe(false);
    const fizzCaster = fizz.caster as CasterState;
    fizzCaster.effortUsed = 0;
    const bot = who(b, 'foe-0-1');
    castMagic(b, fizz, 'stunning-shock', bot.id, undefined);
    expect(bot.stunned).toBe(false);
    castMagic(b, fizz, 'stunning-shock', 'foe-1-0', undefined);
    expect(who(b, 'foe-1-0').stunned).toBe(false);
    expect(castMagic(b, fizz, 'stunning-shock', undefined, undefined)).toBe(false);
  });

  it('limits Inexorable Effect to once a scene, and treats passive arts as unusable directly', () => {
    const { b, fizz, caster } = setup([['skilled-veteran']], [8, 16, 3]);
    caster.usedThisScene.add('inexorable-effect');
    const vet = who(b, 'foe-0-0');
    vet.hp = 20;
    castMagic(b, fizz, 'the-coruscating-coffin', vet.id, undefined);
    expect(vet.hp).toBe(16);
    const active = {
      ...data,
      content: {
        ...data.content,
        combatMagic: data.content.combatMagic.map((x) =>
          x.id === 'empowered-sorcery' ? { ...x, target: 'enemy' as const } : x,
        ),
      },
    };
    const b2 = { ...b, data: active };
    expect(castMagic(b2, fizz, 'empowered-sorcery', vet.id, undefined)).toBe(true);
  });
});
