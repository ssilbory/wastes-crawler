import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/data/schemas/index.ts';
import { act } from '../../../src/game/combat/actions.ts';
import { partyAction } from '../../../src/game/combat/ai.ts';
import { artEffect, counterSpell, retainsSpell, turnArts } from '../../../src/game/combat/arts.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { effectiveAc } from '../../../src/game/combat/damage.ts';
import { save } from '../../../src/game/combat/saves.ts';
import { freeActions } from '../../../src/game/combat/free-actions.ts';
import { runRound } from '../../../src/game/combat/round.ts';
import { canUse, castMagic, combatMagic } from '../../../src/game/combat/spells.ts';
import { hitModifier, targets } from '../../../src/game/combat/targeting.ts';
import type { Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, starter, who } from './helpers.ts';

/** Fizzwick in a class of `level`, holding these arts and Coruscating Coffin. */
function caster(arts: string[], classId = 'full-high-mage', level = 3): Character {
  const fizz = starter('fizzwick');
  return {
    ...fizz,
    classes: { current: classId, levels: { [classId]: level } },
    arts,
    skills: { ...fizz.skills, magic: 1 },
    spells: { known: ['the-coruscating-coffin'], prepared: ['the-coruscating-coffin'] },
  };
}

function battle(c: Character, enemies: string[][] = [['thug-or-militia']], dark = false): Battle {
  return createBattle({
    data,
    rng: createRng('arts'),
    party: [
      { character: starter('snag'), row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
      { character: c, row: 1, column: 0 },
    ],
    enemies,
    log: true,
    dark,
  });
}

const casterOf = (c: Combatant) => c.caster as CasterState;
const fizz = (b: Battle) => who(b, 'Fizzwick');

describe('sight in a dark fight (Phase 15)', () => {
  it('takes -4 to hit until a sight art is committed, and Light of Faith lights the side', () => {
    const b = battle(caster(['sense-magic']), [['thug-or-militia']], true);
    const f = fizz(b);
    expect(hitModifier(b, f)).toBe(-4);
    expect(hitModifier(b, who(b, 'foe-0-0'))).toBe(0);
    freeActions(b, f);
    expect(f.seesInDark).toBe(true);
    expect(hitModifier(b, f)).toBe(0);
    expect(hitModifier(b, who(b, 'Snag'))).toBe(-4);
    expect(casterOf(f).effortUsed).toBe(1);
    // Already seeing, nothing more is committed.
    freeActions(b, f);
    expect(casterOf(f).effortUsed).toBe(1);
    const priest = battle(caster(['the-light-of-faith'], 'blood-priest-partial-warrior'), [], true);
    freeActions(priest, fizz(priest));
    expect(priest.combatants.every((c) => c.side !== 'party' || c.seesInDark)).toBe(true);
  });
});

describe('Counter Magic', () => {
  it('fizzles a foe’s spell on an opposed check, once a round, for day Effort', () => {
    const b = battle(caster(['counter-magic']), [['petty-mage']]);
    const mage = who(b, 'foe-0-0');
    const snag = who(b, 'Snag');
    const hp = snag.hp;
    // Fizzwick 6+6+1+1 = 14 against the mage's 1+1+0+its skill.
    b.rng = scriptedRng([6, 6, 1, 1]);
    expect(castMagic(b, mage, 'the-coruscating-coffin', snag.id, undefined)).toBe(true);
    expect(snag.hp).toBe(hp);
    expect(casterOf(fizz(b)).effortDay).toBe(1);
    expect(b.log?.at(-1)).toContain('and it fizzles');
    expect(counterSpell(b, mage)).toBe(false);
  });

  it('lets a PC caster win ties against a monster counter, and fails on a low roll', () => {
    const b = battle(caster([]), [['petty-mage']]);
    const mage = who(b, 'foe-0-0');
    casterOf(mage).arts.push('counter-magic');
    casterOf(mage).magicSkill = 0;
    const f = fizz(b);
    casterOf(f).castModifier = 0;
    casterOf(f).magicSkill = 0;
    b.rng = scriptedRng([3, 3, 3, 3]);
    expect(counterSpell(b, f)).toBe(false);
    b.round = 2;
    b.rng = scriptedRng([6, 6, 1, 1]);
    expect(counterSpell(b, f)).toBe(true);
    // A PC counterer who rolls low fails.
    const c = battle(caster(['counter-magic']), [['petty-mage']]);
    c.rng = scriptedRng([1, 1, 6, 6]);
    expect(counterSpell(c, who(c, 'foe-0-0'))).toBe(false);
  });
});

describe('Retain Sorcery', () => {
  it('keeps the slot once a rest, and holds off spells until the next turn ends', () => {
    const b = battle(caster(['retain-sorcery']));
    const f = fizz(b);
    const thug = who(b, 'foe-0-0');
    thug.hp = 100;
    const slots = casterOf(f).spellsLeft;
    castMagic(b, f, 'the-coruscating-coffin', thug.id, undefined);
    expect(casterOf(f)).toMatchObject({ spellsLeft: slots, castLock: 2, effortDay: 1 });
    expect(casterOf(f).uses).toEqual({ 'retain-sorcery': 1 });
    const coffin = combatMagic(b, 'the-coruscating-coffin');
    expect(coffin && canUse(b, f, coffin, false, thug.id)).toBe(false);
    b.round = 3;
    expect(retainsSpell(b, f)).toBe(false);
    castMagic(b, f, 'the-coruscating-coffin', thug.id, undefined);
    expect(casterOf(f).spellsLeft).toBe(slots - 1);
  });
});

describe('Swift Casting', () => {
  it('casts the spell On Turn once a scene, then no other spell that round', () => {
    const b = battle(caster(['swift-casting']), [['thug-or-militia', 'thug-or-militia']]);
    const f = fizz(b);
    for (const c of b.combatants) if (c.side === 'enemy') c.hp = 100;
    freeActions(b, f);
    expect(casterOf(f)).toMatchObject({ castLock: 1, effortDay: 1 });
    expect(casterOf(f).usedThisScene.has('swift-casting')).toBe(true);
    expect(b.log?.join('\n')).toContain('casts The Coruscating Coffin');
    // Spent for the scene.
    b.round = 2;
    freeActions(b, f);
    expect(casterOf(f).effortDay).toBe(1);
    // Nothing to cast, nothing spent.
    const c = battle(caster(['swift-casting']));
    casterOf(fizz(c)).spellsLeft = 0;
    freeActions(c, fizz(c));
    expect(casterOf(fizz(c)).effortDay).toBe(0);
  });
});

describe('Psychic Conversion', () => {
  it('turns a slot into 2 hit points a level and 1 strain off, once a rest', () => {
    const b = battle(caster(['psychic-conversion']));
    const f = fizz(b);
    Object.assign(f, { hp: 1, maxHp: 20, strain: { strain: 2, max: 10, broken: false } });
    const slots = casterOf(f).spellsLeft;
    turnArts(b, f);
    expect(f.hp).toBe(7);
    expect(f.strain?.strain).toBe(1);
    expect(casterOf(f).spellsLeft).toBe(slots - 1);
    f.hp = 1;
    turnArts(b, f);
    expect(f.hp).toBe(1);
    // Without a strain track it still heals.
    const c = battle(caster(['psychic-conversion']));
    Object.assign(fizz(c), { hp: 1, maxHp: 20, strain: null });
    turnArts(c, fizz(c));
    expect(fizz(c).hp).toBe(7);
    // A non-caster has nothing to do.
    turnArts(b, who(b, 'Snag'));
  });
});

describe('Steps of Air and Petrifying Stare (1.5.7)', () => {
  it('lifts an ally who can reach no one, for a round per level', () => {
    const b = createBattle({
      data,
      rng: createRng('air'),
      party: [
        { character: starter('snag'), row: 0, column: 0 },
        { character: starter('grukk'), row: 1, column: 1 },
        { character: caster(['steps-of-air'], 'full-elementalist'), row: 1, column: 0 },
      ],
      enemies: [['thug-or-militia']],
      log: true,
    });
    const grukk = who(b, 'Grukk');
    expect(targets(b, grukk, grukk.attacks[0] as never)).toEqual([]);
    freeActions(b, fizz(b));
    expect(grukk.flyingRounds).toBe(3);
    expect(targets(b, grukk, grukk.attacks[0] as never)).toHaveLength(1);
    b.rng = createRng('rounds');
    const wait = () => ({ kind: 'wait' as const });
    runRound(b, wait, wait);
    expect(grukk.flyingRounds).toBe(2);
  });

  it('lands a flyer that fails its save and roots it for half the level', () => {
    const b = battle(caster(['petrifying-stare'], 'full-elementalist'), [
      ['thug-or-militia'],
      ['manticore'],
    ]);
    const manticore = who(b, 'foe-1-0');
    expect(partyAction(b, fizz(b))).toEqual({
      kind: 'cast',
      magic: 'petrifying-stare',
      target: manticore.id,
    });
    b.rng = scriptedRng([2]);
    act(b, fizz(b), { kind: 'cast', magic: 'petrifying-stare', target: manticore.id });
    expect(manticore.tags.has('flying')).toBe(false);
    expect(manticore.rootedRounds).toBe(2);
    // The rooted don't step up when the front row falls.
    who(b, 'foe-0-0').status = 'dead';
    b.rng = createRng('rooted');
    const wait = () => ({ kind: 'wait' as const });
    runRound(b, wait, wait);
    expect(manticore.row).toBe(1);
    expect(manticore.rootedRounds).toBe(1);
    // A save shrugs it off.
    const c = battle(caster(['petrifying-stare'], 'full-elementalist'), [['manticore']]);
    c.rng = scriptedRng([20]);
    castMagic(c, fizz(c), 'petrifying-stare', 'foe-0-0', undefined);
    expect(who(c, 'foe-0-0').tags.has('flying')).toBe(true);
  });
});

describe('Sanctified Ward (1.5.5.1)', () => {
  it('raises AC and saves by 4, turns aside Shock and foes, and ends with a hostile act', () => {
    const b = battle(
      caster(['sanctified-ward', 'merciful-healing'], 'blood-priest-partial-warrior'),
    );
    const f = fizz(b);
    f.hp = 1;
    f.maxHp = 10;
    const ac = effectiveAc(f);
    freeActions(b, f);
    expect(f.sanctified).toBe(true);
    expect(effectiveAc(f)).toBe(ac + 4);
    // The same rolls save more often warded.
    const saves = () => {
      b.rng = createRng('saves');
      return Array.from({ length: 50 }, () => save(b, f, 'mental').success).filter(Boolean).length;
    };
    const warded = saves();
    f.sanctified = false;
    expect(saves()).toBeLessThan(warded);
    f.sanctified = true;
    // Foes pass the warded by, unless acting on Instinct or out of other targets.
    const thug = who(b, 'foe-0-0');
    thug.tags.add('flying');
    expect(targets(b, thug, thug.attacks[0] as never)).not.toContain(f);
    thug.instinctive = true;
    expect(targets(b, thug, thug.attacks[0] as never)).toContain(f);
    // The AI heals, tends, or defends while warded.
    casterOf(f).effortUsed = casterOf(f).effortMax;
    expect(partyAction(b, f)).toEqual({ kind: 'total-defense' });
    who(b, 'Snag').status = 'dying';
    expect(partyAction(b, f).kind).toBe('stabilize');
    // With Effort to spare, a hurt ally is healed.
    casterOf(f).effortMax += 1;
    who(b, 'Snag').status = 'active';
    who(b, 'Grukk').hp = 1;
    expect(partyAction(b, f)).toMatchObject({ kind: 'cast', magic: 'merciful-healing' });
    // An attack ends it, once a scene.
    b.rng = createRng('blow');
    act(b, f, { kind: 'attack', attack: 0, target: thug.id });
    expect(f.sanctified).toBe(false);
    const ward = combatMagic(b, 'sanctified-ward');
    expect(ward && canUse(b, f, ward)).toBe(false);
    // Healing is no hostile act.
    const c = battle(
      caster(['sanctified-ward', 'merciful-healing'], 'blood-priest-partial-warrior'),
    );
    fizz(c).sanctified = true;
    act(c, fizz(c), { kind: 'cast', magic: 'merciful-healing', target: who(c, 'Snag').id });
    expect(fizz(c).sanctified).toBe(true);
    act(c, fizz(c), { kind: 'wait' });
    expect(fizz(c).sanctified).toBe(true);
  });

  it('leaves untouched effects it does not know', () => {
    const b = battle(caster([]));
    expect(artEffect(b, fizz(b), { kind: 'ward' }, undefined)).toBe(false);
    expect(artEffect(b, fizz(b), { kind: 'flight' }, undefined)).toBe(true);
    expect(artEffect(b, fizz(b), { kind: 'petrify', save: 'physical' }, undefined)).toBe(true);
  });
});

describe('free actions already in force', () => {
  it('raise Pavis and Armor of God only once', () => {
    const b = battle(caster(['pavis-of-elements'], 'full-elementalist'));
    const f = fizz(b);
    f.acBonus = 4;
    freeActions(b, f);
    expect(casterOf(f).effortUsed).toBe(0);
    const p = battle(caster(['armor-of-god'], 'blood-priest-partial-warrior'));
    fizz(p).acFloor = 15;
    freeActions(p, fizz(p));
    expect(casterOf(fizz(p)).effortUsed).toBe(0);
    // A lower natural AC (Cold Flesh) still gives way to Armor of God.
    fizz(p).acFloor = 13;
    freeActions(p, fizz(p));
    expect(fizz(p).acFloor).toBe(16);
  });
});
