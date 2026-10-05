import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/data/schemas/index.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { armoredArts } from '../../../src/game/character/magic.ts';
import { act } from '../../../src/game/combat/actions.ts';
import { attackWeakest, partyAction } from '../../../src/game/combat/ai.ts';
import { freeActions } from '../../../src/game/combat/free-actions.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { commandsFor, isLegal } from '../../../src/game/combat/commands.ts';
import { effectiveAc, harm } from '../../../src/game/combat/damage.ts';
import { castMagic } from '../../../src/game/combat/spells.ts';
import type { Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, starter, who } from './helpers.ts';

/** Snag as a Partial Warrior/Blood Priest of `level` with Pray-1, Wis 14, and these miracles. */
function priest(level = 1, arts: string[] = []): Character {
  const snag = starter('snag');
  return {
    ...snag,
    classes: {
      current: 'blood-priest-partial-warrior',
      levels: { 'blood-priest-partial-warrior': level },
    },
    skills: { ...snag.skills, pray: 1 },
    attributes: { ...snag.attributes, base: { ...snag.attributes.base, wis: 14 } },
    arts,
    spells: { known: [], prepared: [] },
  };
}

function battle(c: Character, enemies: string[][]): Battle {
  return createBattle({
    data,
    rng: createRng('miracles'),
    party: [
      { character: c, row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
      { character: starter('lirael'), row: 1, column: 0 },
    ],
    enemies,
    log: true,
  });
}

const casterOf = (c: Combatant) => c.caster as CasterState;

describe('the Blood Priest (1.5.5)', () => {
  it('has Effort from Pray and Wisdom, no spells, and works miracles in armor', () => {
    const c = priest(1, ['armor-of-god', 'merciful-healing']);
    const sheet = characterSheet(c, data);
    expect(sheet.magic).toMatchObject({ effort: 2, canCast: true });
    expect(sheet.magic?.slots).toMatchObject({
      spellsCast: 0,
      spellsPrepared: 0,
      maxSpellLevel: 0,
    });
    expect(armoredArts(data, c.classes)).toBe(true);
    expect(armoredArts(data, starter('fizzwick').classes)).toBe(false);
    expect(armoredArts(data, starter('snag').classes)).toBe(false);
  });

  it('Armor of God: AC 15 plus half the level when it beats the armor worn', () => {
    const b = battle(priest(4, ['armor-of-god']), [['thug-or-militia']]);
    const snag = who(b, 'Snag');
    snag.ac = 12;
    freeActions(b, snag);
    expect(snag.acFloor).toBe(17);
    expect(effectiveAc(snag)).toBe(17);
    snag.totalDefense = true;
    expect(effectiveAc(snag)).toBe(19);
    // No use when worn armor is better already.
    const c = battle(priest(1, ['armor-of-god']), [['thug-or-militia']]);
    const s2 = who(c, 'Snag');
    s2.ac = 18;
    freeActions(c, s2);
    expect(s2.acFloor).toBe(0);
  });

  it('Merciful Healing: heals by tier with 1 strain in combat, and revives the dying', () => {
    const b = battle(priest(4, ['merciful-healing']), [['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const grukk = who(b, 'Grukk');
    Object.assign(grukk, { status: 'dying', hp: 0, fellRound: 1 });
    expect(partyAction(b, snag)).toEqual({
      kind: 'cast',
      magic: 'merciful-healing',
      target: grukk.id,
    });
    const before = grukk.strain?.strain ?? 0;
    // Level 4: 2d6+4 = 3 + 2 + 4.
    b.rng = scriptedRng([3, 2]);
    act(b, snag, { kind: 'cast', magic: 'merciful-healing', target: grukk.id });
    expect(grukk).toMatchObject({ status: 'active', hp: Math.min(grukk.maxHp, 9) });
    expect(grukk.strain?.strain).toBe(before + 1);
    // Effort spent: a second use waits for more.
    expect(commandsFor(b, snag).some((cmd) => cmd.key === 'magic:merciful-healing')).toBe(false);
    // Level 1 heals 1d6+2 on the merely hurt, and an ally at a third of their HP draws it.
    const c = battle(priest(1, ['merciful-healing']), [['thug-or-militia']]);
    const s = who(c, 'Snag');
    const lirael = who(c, 'Lirael');
    lirael.maxHp = 6;
    lirael.hp = 2;
    expect(partyAction(c, s)).toEqual({
      kind: 'cast',
      magic: 'merciful-healing',
      target: lirael.id,
    });
    c.rng = scriptedRng([1]);
    castMagic(c, s, 'merciful-healing', lirael.id, undefined);
    expect(lirael.hp).toBe(5);
    castMagic(c, s, 'merciful-healing', undefined, undefined);
  });

  it('heals monsters on its side without strain, and a stable ally too', () => {
    const b = battle(priest(8, ['merciful-healing']), [['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const lirael = who(b, 'Lirael');
    Object.assign(lirael, { status: 'stable', hp: 0, strain: null });
    // Level 8: 4d6+8.
    b.rng = scriptedRng([1, 1, 1, 1]);
    castMagic(b, snag, 'merciful-healing', lirael.id, undefined);
    expect(lirael).toMatchObject({ status: 'active', hp: Math.min(lirael.maxHp, 12) });
  });

  it('God Wills It: in a hard fight, the side gains +1 to hit, damage, and Shock', () => {
    const b = battle(priest(1, ['god-wills-it']), [['thug-or-militia']]);
    const snag = who(b, 'Snag');
    // One 1-HD thug against three: no need.
    freeActions(b, snag);
    expect(b.hitModifier.party).toBe(0);
    const c = battle(priest(5, ['god-wills-it']), [
      ['veteran-soldier', 'veteran-soldier', 'veteran-soldier'],
    ]);
    const s = who(c, 'Snag');
    freeActions(c, s);
    expect(c.hitModifier.party).toBe(2);
    expect(c.damageBonus.party).toBe(2);
    // Once a scene.
    freeActions(c, s);
    expect(c.hitModifier.party).toBe(2);
    const d = battle(priest(10, ['god-wills-it']), [['thug-or-militia']]);
    castMagic(d, who(d, 'Snag'), 'god-wills-it', undefined, undefined);
    expect(d.damageBonus.party).toBe(3);
    expect(commandsFor(c, s).find((cmd) => cmd.key === 'magic:god-wills-it')).toBeUndefined();
    const e = battle(priest(1, ['god-wills-it']), [['thug-or-militia']]);
    expect(
      commandsFor(e, who(e, 'Snag')).find((cmd) => cmd.key === 'magic:god-wills-it')?.choices,
    ).toEqual([{ label: 'Everyone', action: { kind: 'cast', magic: 'god-wills-it' } }]);
  });

  it('adds the blessing to hits and to Shock on a miss', () => {
    const b = battle(priest(1, ['god-wills-it']), [['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const thug = who(b, 'foe-0-0');
    thug.hp = 50;
    thug.ac = 10;
    b.damageBonus.party = 2;
    const spear = snag.attacks[0] as Combatant['attacks'][0];
    // A miss (1) with Shock: the weapon's Shock plus 2.
    b.rng = scriptedRng([1]);
    act(b, snag, { kind: 'attack', attack: 0, target: thug.id });
    expect(thug.hp).toBe(50 - ((spear.shock?.damage ?? 0) + 2));
  });

  it('Smite the Wicked: +4 to hit, the level in damage, best of two damage rolls, once per target', () => {
    const b = battle(priest(3, ['smite-the-wicked']), [['veteran-soldier']]);
    const snag = who(b, 'Snag');
    const vet = who(b, 'foe-0-0');
    vet.hp = 100;
    vet.hitDice = 3;
    expect(attackWeakest(b, snag)).toMatchObject({ smite: true });
    const smites = commandsFor(b, snag).filter((cmd) => cmd.key.startsWith('smite:'));
    expect(smites.length).toBeGreaterThan(0);
    const choice = smites[0]?.choices.find((ch) => ch.targetId === vet.id);
    expect(choice && isLegal(b, snag, choice.action)).toBe(true);
    // Hit roll 15; damage rolls 1 and 4, keeping 4, plus level 3.
    b.rng = scriptedRng([15, 1, 4]);
    const attack = snag.attacks[0] as Combatant['attacks'][0];
    act(b, snag, { kind: 'attack', attack: 0, target: vet.id, smite: true });
    const hitBy = 100 - vet.hp;
    expect(hitBy).toBeGreaterThanOrEqual(4 + attack.damageBonus + 3);
    // Used on that target: an ordinary attack follows.
    expect(attackWeakest(b, snag)).not.toMatchObject({ smite: true });
    b.rng = createRng('plain');
    act(b, snag, { kind: 'attack', attack: 0, target: vet.id, smite: true });
    // Weak foes don't draw it.
    const c = battle(priest(3, ['smite-the-wicked']), [['thug-or-militia']]);
    expect(attackWeakest(c, who(c, 'Snag'))).not.toMatchObject({ smite: true });
    // Without the art, no smite commands.
    const d = battle(priest(3, []), [['thug-or-militia']]);
    expect(commandsFor(d, who(d, 'Snag')).some((cmd) => cmd.key.startsWith('smite:'))).toBe(false);
    casterOf(who(c, 'Snag')).effortUsed = 99;
    expect(commandsFor(c, who(c, 'Snag')).some((cmd) => cmd.key.startsWith('smite:'))).toBe(false);
  });

  it('Turn False Life: undead and automatons within the rolled hit dice cower on a failed save', () => {
    const b = battle(priest(2, ['turn-false-life']), [
      ['zombie', 'zombie', 'automaton-humanlike', 'thug-or-militia'],
      ['grave-wyrm'],
    ]);
    const snag = who(b, 'Snag');
    expect(partyAction(b, snag)).toEqual({ kind: 'cast', magic: 'turn-false-life' });
    // 2d6 = 2 + 2, plus level 2: 6 hit dice. Zombie (fails, 2), zombie (saves, 2), automaton
    // (fails, 2); the wyrm has more than twice the level; the thug isn't unnatural.
    b.rng = scriptedRng([2, 2, 1, 20, 1]);
    act(b, snag, { kind: 'cast', magic: 'turn-false-life' });
    expect(
      ['foe-0-0', 'foe-0-1', 'foe-0-2', 'foe-0-3', 'foe-1-0'].map((id) => who(b, id).status),
    ).toEqual(['out', 'active', 'out', 'active', 'active']);
    // A roll too small for a creature leaves it be.
    const c = battle(priest(1, ['turn-false-life']), [['automaton-military']]);
    c.rng = scriptedRng([1, 1]);
    act(c, who(c, 'Snag'), { kind: 'cast', magic: 'turn-false-life' });
    expect(who(c, 'foe-0-0').status).toBe('active');
    // The roll runs out: the second zombie is left standing.
    const z = battle(priest(1, ['turn-false-life']), [['zombie', 'zombie']]);
    const turn = commandsFor(z, who(z, 'Snag')).find((cmd) => cmd.key === 'magic:turn-false-life');
    expect(turn?.choices).toEqual([
      { label: 'Everyone', action: { kind: 'cast', magic: 'turn-false-life' } },
    ]);
    z.rng = scriptedRng([1, 1, 1]);
    act(z, who(z, 'Snag'), { kind: 'cast', magic: 'turn-false-life' });
    expect([who(z, 'foe-0-0').status, who(z, 'foe-0-1').status]).toEqual(['out', 'active']);
    // No unnatural foes, no turning.
    const d = battle(priest(1, ['turn-false-life']), [['thug-or-militia']]);
    expect(partyAction(d, who(d, 'Snag'))).not.toMatchObject({ magic: 'turn-false-life' });
  });

  it('Wrath of the Most High: the next damage by the end of next round adds 1d8 + level', () => {
    const b = battle(priest(2, ['wrath-of-the-most-high']), [
      ['thug-or-militia', 'veteran-soldier'],
    ]);
    const snag = who(b, 'Snag');
    const vet = who(b, 'foe-0-1');
    vet.hp = 50;
    b.rng = scriptedRng([5]);
    act(b, snag, { kind: 'cast', magic: 'wrath-of-the-most-high', target: vet.id });
    expect(vet.wrath).toEqual({ until: b.round + 1, bonus: 7 });
    harm(b, vet, 3);
    expect(vet.hp).toBe(40);
    harm(b, vet, 3);
    expect(vet.hp).toBe(37);
    // It lapses after the next round.
    b.rng = scriptedRng([5]);
    act(b, snag, { kind: 'cast', magic: 'wrath-of-the-most-high', target: vet.id });
    b.round += 2;
    harm(b, vet, 3);
    expect(vet.hp).toBe(34);
    const c = battle(priest(2, ['wrath-of-the-most-high']), [['thug-or-militia']]);
    expect(castMagic(c, who(c, 'Snag'), 'wrath-of-the-most-high', undefined, undefined)).toBe(true);
  });

  it('lists the dying and stable among Merciful Healing targets', () => {
    const b = battle(priest(1, ['merciful-healing']), [['thug-or-militia']]);
    const grukk = who(b, 'Grukk');
    Object.assign(grukk, { status: 'stable', hp: 0 });
    const lirael = who(b, 'Lirael');
    lirael.hp = lirael.maxHp - 1;
    const heal = commandsFor(b, who(b, 'Snag')).find((cmd) => cmd.key === 'magic:merciful-healing');
    expect(heal?.choices.map((ch) => ch.targetId)).toEqual([grukk.id, lirael.id]);
  });
});
