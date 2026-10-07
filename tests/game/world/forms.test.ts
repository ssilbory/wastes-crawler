import { describe, expect, it } from 'vitest';
import type { Character, Form } from '../../../src/data/schemas/index.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { carryBack } from '../../../src/game/world/carry-back.ts';
import { encounterBattle } from '../../../src/game/world/fight.ts';
import { shifters, shiftMember } from '../../../src/game/world/forms.ts';
import { setForms } from '../../../src/game/world/practice.ts';
import { addMemberStrain, checkBonus, memberSheet } from '../../../src/game/world/members.ts';
import { trainMember } from '../../../src/game/world/training.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { shifter, WAR, WOLF } from '../shifter.ts';
import { data, encounter, member, world } from './helpers.ts';

const HAWK: Form = { name: 'Hawk', humanoid: false, arts: ['eyes-of-the-hawk'] };
const BEAR: Form = { name: 'Bear', humanoid: false, arts: ['feral-prowess'], feral: 'con' };

/** Snag in the party as a Skinshifter with the given forms and arts. */
function snagShifter(w: World, forms: Form[] = [WOLF, WAR, HAWK], arts: string[] = []): Member {
  const m = member(w, 'Snag');
  const c = shifter(undefined, forms, arts);
  m.character = { ...c, id: m.character.id, hp: { max: 20, current: 20 } };
  return m;
}

describe('changing form outside a fight (1.5.15)', () => {
  it('spends Effort for the day, or nothing with Pliant Flesh, and goes back for free', () => {
    const w = world();
    const m = snagShifter(w);
    // Survive-0 and Con +0: Effort 1.
    expect(shiftMember(w, data, m.id, 0)).toEqual({ ok: true });
    expect([m.form, m.effortDay]).toEqual([0, 1]);
    expect(w.log.at(-1)).toContain('Snag takes the Wolf form.');
    expect(shiftMember(w, data, m.id, 0)).toEqual({
      ok: false,
      reason: 'Snag is already in the Wolf form.',
    });
    expect(shiftMember(w, data, m.id, 1)).toEqual({
      ok: false,
      reason: 'Snag has no Effort left today.',
    });
    expect(shiftMember(w, data, m.id, null)).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('Snag returns to their own shape.');
    expect(shiftMember(w, data, m.id, null)).toEqual({
      ok: false,
      reason: 'Snag is in their own shape.',
    });
    expect(shiftMember(w, data, m.id, 7)).toEqual({ ok: false, reason: 'Snag has no such form.' });
    const pliant = snagShifter(world(), [WOLF], ['pliant-flesh']);
    const w2 = world();
    Object.assign(member(w2, 'Snag'), { character: pliant.character });
    expect(shiftMember(w2, data, member(w2, 'Snag').id, 0)).toEqual({ ok: true });
    expect(member(w2, 'Snag').effortDay).toBe(0);
  });

  it('lists only living, awake Skinshifters with forms', () => {
    const w = world();
    const m = snagShifter(w);
    expect(shifters(w)).toEqual([m]);
    m.character = { ...m.character, forms: [] };
    expect(shifters(w)).toEqual([]);
    const formless = { ...m.character };
    delete formless.forms;
    m.character = formless;
    expect(shifters(w)).toEqual([]);
    expect(shiftMember(w, data, m.id, 0)).toEqual({
      ok: false,
      reason: 'No one is able to change form.',
    });
  });

  it('applies the form to checks: Eyes of the Hawk adds +2 to Notice', () => {
    const w = world();
    const m = snagShifter(w);
    const notice = checkBonus(data, m, 'notice', ['wis']);
    m.form = 2;
    expect(checkBonus(data, m, 'notice', ['wis'])).toBe(notice + 2);
    expect(checkBonus(data, m, 'sneak', ['dex'])).toBe(
      checkBonus(data, { ...m, form: null }, 'sneak', ['dex']),
    );
    m.form = 1;
    expect(memberSheet(data, m).modifiers.cha).toBe(0);
  });

  it('lasts through the night, with Feral Prowess’s hit points', () => {
    const w = world();
    const m = snagShifter(w, [BEAR]);
    shiftMember(w, data, m.id, 0);
    // Con +0 to +1 at level 3.
    expect(m.character.hp).toEqual({ max: 23, current: 23 });
    endOfDay(w, data);
    expect([m.form, m.character.hp.max]).toEqual([0, 23]);
  });

  it('is worn into a fight and carried back out, and lost with death', () => {
    const w = world();
    const m = snagShifter(w, [BEAR]);
    shiftMember(w, data, m.id, 0);
    w.encounter = encounter([['thug-or-militia']]);
    const fight = encounterBattle(w, data);
    const c = fight.battle.combatants.find((x) => x.name === 'Snag');
    expect([c?.form, c?.maxHp]).toEqual([0, 23]);
    if (!c) throw new Error('no Snag');
    c.form = null;
    c.character = { ...m.character, hp: { max: 20, current: 20 } };
    c.hp = 12;
    carryBack(data, m, c);
    expect([m.form, m.character.hp]).toEqual([null, { max: 20, current: 12 }]);
    m.form = 0;
    m.character = { ...m.character, hp: { max: 23, current: 23 } };
    Object.assign(c, { form: 0, status: 'dead', character: m.character });
    carryBack(data, m, c);
    expect([m.dead, m.form, m.character.hp.max]).toEqual([true, null, 20]);
  });

  it('loads a version 29 save with no form worn', () => {
    const w = world();
    w.benched = [w.members.pop() as Member];
    const save = JSON.parse(serializeWorld(w));
    const plain = (list: Record<string, unknown>[]) =>
      list.map((m) => Object.fromEntries(Object.entries(m).filter(([k]) => k !== 'form')));
    const v29 = {
      ...save,
      schemaVersion: 29,
      members: plain(save.members),
      benched: plain(save.benched),
    };
    const loaded = parseWorld(JSON.stringify(v29), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    expect([...loaded.world.members, ...loaded.world.benched].every((m) => m.form === null)).toBe(
      true,
    );
  });
});

describe('practicing forms in town (1.5.15)', () => {
  it('fills an empty slot for free, and reshapes a kept form with a night at the inn', () => {
    const w = world();
    const m = snagShifter(w, [WOLF], ['sculptors-beauty', 'warform']);
    const day = w.day;
    expect(setForms(w, data, m.id, [WOLF, WAR])).toEqual({ ok: true });
    expect([m.character.forms, w.day]).toEqual([[WOLF, WAR], day]);
    w.purse = 0;
    expect(setForms(w, data, m.id, [WAR])).toMatchObject({ ok: false });
    expect(m.character.forms).toEqual([WOLF, WAR]);
    w.purse = 100;
    expect(setForms(w, data, m.id, [WAR])).toEqual({ ok: true });
    expect([m.character.forms, w.day]).toEqual([[WAR], day + 1]);
    expect(w.log.join('\n')).toContain('Snag spends the day reshaping their forms.');
    // Reshaping the worn form puts the member back in their own shape; keeping it doesn't.
    shiftMember(w, data, m.id, 0);
    expect(m.form).toBe(0);
    expect(setForms(w, data, m.id, [WAR, WOLF])).toEqual({ ok: true });
    expect(m.form).toBe(0);
    expect(setForms(w, data, m.id, [{ ...WAR, name: 'Battle Shape' }, WOLF])).toEqual({ ok: true });
    expect(m.form).toBeNull();
  });

  it('refuses forms the member can’t keep, or a member who isn’t there', () => {
    const w = world();
    const m = snagShifter(w, [WOLF]);
    expect(setForms(w, data, m.id, [WOLF, WAR, HAWK, BEAR])).toEqual({
      ok: false,
      reason: 'Snag can keep 3 forms.',
    });
    const fresh = { ...m.character };
    delete fresh.forms;
    m.character = fresh;
    expect(setForms(w, data, m.id, [WOLF])).toEqual({ ok: true });
    expect(setForms(w, data, 'nobody', [])).toEqual({
      ok: false,
      reason: 'No one is here to practice.',
    });
  });

  it('counts a form whose arts were only picked in another order as unchanged', () => {
    const w = world();
    const m = snagShifter(w, [WOLF]);
    const day = w.day;
    expect(setForms(w, data, m.id, [{ ...WOLF, arts: [...WOLF.arts].reverse() }])).toEqual({
      ok: true,
    });
    expect(w.day).toBe(day);
  });
});

describe('a form in town and at death (1.5.15)', () => {
  it('trains in the own shape, then puts the form back on', () => {
    const w = world();
    const m = snagShifter(w, [BEAR]);
    shiftMember(w, data, m.id, 0);
    expect(trainMember(w, data, m.id, () => ({ ok: false, reason: 'no' }))).toMatchObject({
      ok: false,
    });
    expect([m.form, m.character.hp.max]).toEqual([0, 23]);
    // Training sees the own shape's 20 hit points; the form adds its 3 again after.
    let seen = 0;
    const step = (c: Character) => {
      seen = c.hp.max;
      return { ok: true as const, character: { ...c, hp: { max: c.hp.max + 5, current: 25 } } };
    };
    expect(trainMember(w, data, m.id, step)).toEqual({ ok: true });
    expect([seen, m.form, m.character.hp]).toEqual([20, 0, { max: 28, current: 28 }]);
  });

  it('ends with death from strain', () => {
    const w = world();
    const m = snagShifter(w, [BEAR]);
    shiftMember(w, data, m.id, 0);
    const max = memberSheet(data, m).strainMax;
    m.character = { ...m.character, strain: { value: 2 * max - 1, broken: true } };
    addMemberStrain(w, data, m, 5, 'condition');
    expect([m.dead, m.form, m.character.hp.max]).toEqual([true, null, 20]);
  });
});
