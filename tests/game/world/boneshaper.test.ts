import { describe, expect, it } from 'vitest';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { characterBonuses } from '../../../src/game/character/shaping.ts';
import { boneshape, liftShaping } from '../../../src/game/world/boneshaper.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { below } from '../dungeon/helpers.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Fizzwick as a level-`level` Necromancer with Boneshaper prepared. */
function necromancer(w: World, level = 10): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-necromancer', levels: { 'full-necromancer': level } },
    spells: { known: ['boneshaper'], prepared: ['boneshaper'] },
    arts: ['bonetalker'],
  };
  return m;
}

const fail = (reason: string) => ({ ok: false, reason });
const mods = (m: Member) => characterSheet(m.character, data).modifiers;

/** Casts with a fresh day's spells each time. */
function shape(w: World, f: Member, t: Member, raise: string, lower: string) {
  f.spellsCast = 0;
  return boneshape(w, data, f.id, t.id, raise as never, lower as never);
}

describe('Boneshaper', () => {
  it('adds +1 to one modifier at the cost of −1 to another, until lifted', () => {
    const w = world();
    const f = necromancer(w);
    const snag = member(w, 'Snag');
    expect(mods(snag)).toMatchObject({ str: 0, con: 0, dex: 1, cha: -1 });
    expect(boneshape(w, data, f.id, snag.id, 'str', 'con')).toEqual({ ok: true });
    expect(f.spellsCast).toBe(1);
    expect(snag.character.shaped).toEqual({ by: f.character.id, changes: { str: 1, con: -1 } });
    expect(mods(snag)).toMatchObject({ str: 1, con: -1 });
    expect(w.log.at(-1)).toContain("Fizzwick reshapes Snag's flesh and bone.");
    expect(liftShaping(w, f.id, snag.id)).toEqual({ ok: true });
    expect('shaped' in snag.character).toBe(false);
    expect(mods(snag)).toMatchObject({ str: 0, con: 0 });
    expect(f.spellsCast).toBe(1);
  });

  it('never shapes a modifier past +2 or below −2', () => {
    const w = world();
    const f = necromancer(w);
    const snag = member(w, 'Snag');
    expect(shape(w, f, snag, 'dex', 'cha')).toEqual({ ok: true });
    expect(mods(snag)).toMatchObject({ dex: 2, cha: -2 });
    expect(shape(w, f, snag, 'dex', 'con')).toEqual(fail("Snag's DEX can be shaped no higher."));
    expect(shape(w, f, snag, 'str', 'cha')).toEqual(fail("Snag's CHA can be shaped no lower."));
  });

  it('keeps each attribute within ±2 of its own shape', () => {
    const w = world();
    const f = necromancer(w);
    expect(mods(f).str).toBe(-1);
    expect(shape(w, f, f, 'str', 'con')).toEqual({ ok: true });
    expect(shape(w, f, f, 'str', 'cha')).toEqual({ ok: true });
    expect(mods(f).str).toBe(1);
    expect(shape(w, f, f, 'str', 'dex')).toEqual(fail("Fizzwick's STR can be shaped no higher."));
  });

  it('drops changes shaped back to nothing, and the shaping with them', () => {
    const w = world();
    const f = necromancer(w);
    const snag = member(w, 'Snag');
    shape(w, f, snag, 'str', 'con');
    shape(w, f, snag, 'con', 'dex');
    expect(snag.character.shaped?.changes).toEqual({ str: 1, dex: -1 });
    shape(w, f, snag, 'dex', 'str');
    expect('shaped' in snag.character).toBe(false);
  });

  it('shapes only Charisma and the physical attributes, two different ones', () => {
    const w = world();
    const f = necromancer(w);
    const why = fail(
      'Raise one of Strength, Dexterity, Constitution, or Charisma and lower another.',
    );
    expect(shape(w, f, f, 'str', 'str')).toEqual(why);
    expect(shape(w, f, f, 'int', 'str')).toEqual(why);
    expect(shape(w, f, f, 'str', 'wis')).toEqual(why);
  });

  it('refuses the dead, another hand, and anywhere but above ground at peace', () => {
    const w = world();
    const f = necromancer(w);
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, shaped: { by: 'char-00000000', changes: { str: 1 } } };
    expect(shape(w, f, snag, 'str', 'con')).toEqual(
      fail('Snag is already shaped by another hand.'),
    );
    expect(liftShaping(w, f.id, snag.id)).toEqual(fail('Fizzwick has not shaped them.'));
    snag.dead = true;
    expect(shape(w, f, snag, 'str', 'con')).toEqual(fail('Only a living member can be shaped.'));
    w.encounter = encounter([['thug-or-militia']]);
    expect(shape(w, f, f, 'str', 'con')).toEqual(fail('Settle the encounter first.'));
    w.encounter = null;
    w.coach = { route: 'x', to: 'y', path: [], checkedDay: null };
    const away = fail('Boneshaping takes an hour of quiet work above ground.');
    expect(shape(w, f, f, 'str', 'con')).toEqual(away);
    const d = below();
    const g = necromancer(d);
    expect(shape(d, g, g, 'str', 'con')).toEqual(away);
    f.character.spells.prepared = [];
    w.coach = null;
    expect(shape(w, f, f, 'str', 'con')).toEqual(fail("Fizzwick hasn't prepared Boneshaper."));
    const low = world();
    const l = necromancer(low, 6);
    expect(shape(low, l, l, 'str', 'con')).toEqual(fail("Fizzwick can't cast level-4 spells yet."));
  });

  it('can be lifted only by a caster able to act', () => {
    const w = world();
    const f = necromancer(w);
    const snag = member(w, 'Snag');
    shape(w, f, snag, 'str', 'con');
    f.character.hp.current = 0;
    expect(liftShaping(w, f.id, snag.id)).toEqual(fail('No one is able to lift that.'));
    expect(liftShaping(w, 'nobody', snag.id)).toEqual(fail('No one is able to lift that.'));
    f.character.hp.current = 1;
    expect(liftShaping(w, f.id, 'nobody')).toEqual(fail('Fizzwick has not shaped them.'));
  });

  it('adds to focus bonuses', () => {
    expect(
      characterBonuses({
        foci: [{ id: 'developed-attribute', level: 1, attribute: 'str' }],
        shaped: { by: 'char-00000000', changes: { str: 1, cha: -1 } },
      }),
    ).toEqual({ str: 2, cha: -1 });
    expect(characterBonuses({ foci: [] })).toEqual({});
  });
});
