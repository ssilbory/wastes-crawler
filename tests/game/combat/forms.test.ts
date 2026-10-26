import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/data/schemas/index.ts';
import { act } from '../../../src/game/combat/actions.ts';
import { partyAction } from '../../../src/game/combat/ai.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import { canShift, freeShift, shiftChoices, venom } from '../../../src/game/combat/forms.ts';
import { readyOrStow } from '../../../src/game/combat/gear.ts';
import { currentActor, takeTurn } from '../../../src/game/combat/round.ts';
import type { Action, Battle, CasterState, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { shifter, WAR, WOLF } from '../shifter.ts';
import { data, who } from './helpers.ts';

/** Snag the shifter, Survive-2 for Effort 2, alone against a thug. */
function fight(c: Character = shifter(), faces: number[] = [], form: number | null = null) {
  const b = createBattle({
    data,
    rng: createRng('forms'),
    party: [{ character: { ...c, skills: { ...c.skills, survive: 2 } }, form }],
    enemies: [['thug-or-militia']],
    log: true,
  });
  b.rng = scriptedRng(faces);
  const snag = who(b, 'Snag');
  return { b, snag, caster: snag.caster as CasterState };
}

const log = (b: Battle) => (b.log ?? []).join('\n');
const shiftTo = (form: number | null): Action => ({ kind: 'shift', form });
/** Snag's turn first, whoever rolled higher. */
const first = (b: Battle, snag: Combatant) => {
  b.queue = [snag.id, ...b.queue.filter((id) => id !== snag.id)];
};

describe('Change Form in a fight (1.5.15)', () => {
  it('offers each other form, and the own shape once in one', () => {
    const { b, snag } = fight();
    const command = commandsFor(b, snag).find((c) => c.key === 'shift');
    expect(command?.choices.map((c) => c.label)).toEqual(['Wolf form', 'War Shape form']);
    act(b, snag, shiftTo(0));
    expect(shiftChoices(snag).map((c) => c.label)).toEqual(['War Shape form', 'Own shape']);
    // No change without the art, or without Effort.
    const plain = fight(shifter(undefined, [WOLF], ['pliant-flesh']));
    plain.caster.arts = plain.caster.arts.filter((a) => a !== 'change-form');
    expect(commandsFor(plain.b, plain.snag).some((c) => c.key === 'shift')).toBe(false);
    const spent = fight();
    spent.caster.effortUsed = 3;
    expect(canShift(spent.snag, 0)).toBe(false);
    expect(canShift(spent.snag, null)).toBe(false);
    expect(canShift(spent.snag, 9)).toBe(false);
    // Armor blocks the change unless the art works in it.
    const armored = fight();
    expect(armored.caster.armorFree).toContain('change-form');
    Object.assign(armored.caster, { canCast: false, armorFree: [] });
    expect(canShift(armored.snag, 0)).toBe(false);
    armored.caster.armorFree = ['change-form'];
    expect(canShift(armored.snag, 0)).toBe(true);
    expect(freeShift(armored.b, armored.snag, { kind: 'wait' })).toBe(false);
  });

  it('takes the form for Effort for the day, with its attacks, AC, and modifiers', () => {
    const { b, snag, caster } = fight(shifter(undefined, [WOLF, WAR], []));
    expect(snag.attacks.some((a) => a.id === 'savage-talons')).toBe(false);
    act(b, snag, shiftTo(0));
    expect(snag).toMatchObject({ form: 0, ac: 17, modifiers: { dex: 2 }, healModifier: 2 });
    expect(snag.attacks.some((a) => a.id === 'savage-talons')).toBe(true);
    expect([caster.effortUsed, caster.effortDay]).toEqual([1, 1]);
    expect(log(b)).toContain('Snag takes the Wolf form.');
    // Gear readied mid-fight keeps the form's attacks.
    const dagger = snag.character?.inventory.findIndex((e) => e.id === 'dagger') ?? -1;
    readyOrStow(b, snag, dagger, 'stowed');
    expect(snag.attacks.some((a) => a.id === 'savage-talons')).toBe(true);
    // Going back is free.
    act(b, snag, shiftTo(null));
    expect([snag.form, snag.ac, caster.effortUsed]).toEqual([null, 11, 1]);
    expect(log(b)).toContain('Snag returns to their own shape.');
    // A form it can't take does nothing.
    act(b, snag, shiftTo(7));
    expect(snag.form).toBeNull();
  });

  it('heals 1d6 plus the level with Pliant Flesh, and leaves the turn’s Main Action once a round', () => {
    const { b, snag, caster } = fight(shifter(), [4]);
    first(b, snag);
    snag.hp = 1;
    let calls = 0;
    const plan: Action[] = [shiftTo(0), shiftTo(1), { kind: 'total-defense' }];
    takeTurn(b, snag, () => plan[calls++] as Action);
    // 1d6 = 4, plus level 3.
    expect([snag.form, snag.hp, currentActor(b)?.id]).toEqual([0, 8, snag.id]);
    expect(log(b)).toContain("Snag's flesh knits as it changes: 7 hit points.");
    // A second change this round is the Main Action.
    b.rng = scriptedRng([6]);
    takeTurn(b, snag, () => plan[calls++] as Action);
    expect([snag.form, currentActor(b)?.id === snag.id, caster.effortUsed]).toEqual([1, false, 2]);
    // At full hit points there is nothing to heal.
    const whole = fight(shifter(), [6]);
    act(whole.b, whole.snag, shiftTo(0));
    expect(log(whole.b)).not.toContain('flesh knits');
  });

  it('goes back to the own shape On Turn, then acts', () => {
    const { b, snag } = fight(shifter(undefined, [WOLF, WAR], []), [], 0);
    first(b, snag);
    const plan: Action[] = [shiftTo(null), { kind: 'total-defense' }];
    let calls = 0;
    takeTurn(b, snag, () => plan[calls++] as Action);
    expect([snag.form, currentActor(b)?.id]).toEqual([null, snag.id]);
    takeTurn(b, snag, () => plan[calls++] as Action);
    expect([snag.totalDefense, currentActor(b)?.id === snag.id]).toEqual([true, false]);
  });

  it('raises and lowers hit points with Feral Prowess on Constitution', () => {
    const tough = { ...WOLF, name: 'Bear', feral: 'con' as const };
    const { b, snag } = fight(shifter(undefined, [tough], []));
    const max = snag.maxHp;
    act(b, snag, shiftTo(0));
    // Con +0 to +1 at level 3.
    expect([snag.maxHp, snag.hp, snag.character?.hp.max]).toEqual([max + 3, max + 3, max + 3]);
    // Survive-2 and Con +1: the Effort ceiling rises to 3 in the form.
    expect(snag.caster?.effortMax).toBe(3);
    act(b, snag, shiftTo(null));
    expect([snag.maxHp, snag.hp, snag.caster?.effortMax]).toEqual([max, max, 2]);
  });

  it('takes its first form as soon as the AI can', () => {
    const { b, snag, caster } = fight();
    expect(partyAction(b, snag)).toEqual(shiftTo(0));
    act(b, snag, shiftTo(0));
    expect(partyAction(b, snag).kind).not.toBe('shift');
    caster.effortUsed = 3;
    act(b, snag, shiftTo(null));
    expect(partyAction(b, snag).kind).not.toBe('shift');
  });
});

describe('Serpent’s Kiss (1.5.15)', () => {
  const c = () =>
    shifter(undefined, [
      { name: 'Viper', humanoid: false, arts: ['savage-talons', 'serpents-kiss'] },
    ]);

  it('adds 1d8 plus Survive to a Savage Talons hit for Effort for the scene', () => {
    // Hit 20; talons 1d8 = 3; venom 1d8 = 5.
    const { b, snag, caster } = fight(c(), [20, 3, 5], 0);
    const thug = who(b, 'foe-0-0');
    thug.hp = 30;
    const talons = snag.attacks.find((a) => a.id === 'savage-talons') as Combatant['attacks'][0];
    resolveAttack(b, snag, talons, thug);
    // Survive-2.
    expect(log(b)).toContain("Snag's venom burns for 7 more.");
    expect([caster.effortUsed, caster.effortDay]).toEqual([1, 0]);
    // Not with other weapons, out of Effort, or out of the form.
    const spear = snag.attacks.find((a) => a.id !== 'savage-talons') as Combatant['attacks'][0];
    expect(venom(b, snag, spear, thug)).toBe(0);
    caster.effortUsed = 3;
    expect(venom(b, snag, talons, thug)).toBe(0);
    snag.form = null;
    caster.effortUsed = 0;
    expect(venom(b, snag, talons, thug)).toBe(0);
    expect(venom(b, who(b, 'foe-0-0'), talons, snag)).toBe(0);
    // Nothing for the immune to poison.
    thug.poisonImmune = true;
    expect(venom(b, snag, talons, thug)).toBe(0);
    thug.poisonImmune = false;
    // Untrained in Survive, the venom adds nothing for it.
    snag.form = 0;
    delete snag.skills.survive;
    b.rng = scriptedRng([4]);
    expect(venom(b, snag, talons, thug)).toBe(4);
  });

  it('is not spent on a blow Veteran’s Luck turns aside', () => {
    // Hit 20; talons 1d8 = 8, enough to drop the thug; the venom's d8 is rolled, not spent.
    const { b, snag, caster } = fight(c(), [20, 8, 3], 0);
    const thug = who(b, 'foe-0-0');
    Object.assign(thug, { hp: 2, veteransLuck: true });
    const talons = snag.attacks.find((a) => a.id === 'savage-talons') as Combatant['attacks'][0];
    resolveAttack(b, snag, talons, thug);
    expect(log(b)).toContain("veteran's luck turns aside Snag's blow");
    expect(log(b)).not.toContain('venom');
    expect(caster.effortUsed).toBe(0);
  });

  it('counts toward a blow that would drop the target, for Veteran’s Luck', () => {
    // Talons 1 does too little alone against 9 HP; the venom's 8 plus Survive-2 drops the thug.
    const { b, snag, caster } = fight(c(), [20, 1, 8], 0);
    const thug = who(b, 'foe-0-0');
    Object.assign(thug, { hp: 9, veteransLuck: true });
    const talons = snag.attacks.find((a) => a.id === 'savage-talons') as Combatant['attacks'][0];
    resolveAttack(b, snag, talons, thug);
    expect(log(b)).toContain("veteran's luck turns aside Snag's blow");
    // Turned into a miss, which still deals its Shock.
    expect([thug.status, caster.effortUsed]).toEqual(['active', 0]);
  });
});
