import { describe, expect, it } from 'vitest';
import { applyBattle, encounterBattle } from '../../../src/game/world/fight.ts';
import { infusable, infuse, VANISH, vanish, VISCERA } from '../../../src/game/world/sorcery.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Fizzwick as a fifth-level High Mage with both spells prepared. */
function sorcerer(w: World): Member {
  const f = member(w, 'Fizzwick');
  f.character = {
    ...f.character,
    classes: { current: 'full-high-mage', levels: { 'full-high-mage': 5 } },
    spells: { known: [VANISH, VISCERA], prepared: [VANISH, VISCERA] },
  };
  return f;
}

const hp = (m: Member, current: number, max = m.character.hp.max) => {
  m.character = { ...m.character, hp: { max, current } };
};

describe('High Magic outside fights (Sam’s calls)', () => {
  it('The Excellent Transpicuous Transformation: the party slips away from a group it meets', () => {
    const w = world();
    const f = sorcerer(w);
    expect(vanish(w, data, f.id)).toEqual({
      ok: false,
      reason: 'There is no one to slip away from.',
    });
    w.encounter = encounter([['thug-or-militia']], { spotted: true });
    expect(vanish(w, data, f.id)).toEqual({
      ok: false,
      reason: 'The party can leave without magic.',
    });
    w.encounter = encounter([['thug-or-militia']], { spotted: false });
    expect(vanish(w, data, member(w, 'Snag').id)).toMatchObject({ ok: false });
    const quarter = w.quarter;
    expect(vanish(w, data, f.id)).toEqual({ ok: true });
    expect([w.encounter, f.spellsCast, w.quarter]).toEqual([null, 1, quarter + 1]);
    expect(w.log).toContainEqual(expect.stringContaining('turns the party clear as glass'));
    expect(w.log).toContainEqual(expect.stringContaining('slips away unseen'));
  });

  it('Conjunct the Vital Viscera: hit points flow from the member with the most to spare', () => {
    const w = world();
    const f = sorcerer(w);
    const [snag, grukk, lirael] = ['Snag', 'Grukk', 'Lirael'].map((n) => member(w, n)) as [
      Member,
      Member,
      Member,
    ];
    hp(snag, 1, 20);
    hp(grukk, 30, 30);
    hp(lirael, 10, 20);
    hp(f, 5, 10);
    expect(infusable(w)).toEqual([snag, lirael, f]);
    expect(infuse(w, data, f.id, snag.id)).toEqual({ ok: true });
    expect([snag.character.hp.current, grukk.character.hp.current, f.spellsCast]).toEqual([
      16, 15, 1,
    ]);
    expect(w.log.at(-1)).toContain('15 hit points flow from Grukk into Snag.');
    // Only Snag has any to spare now, so no one can give Snag more.
    expect(infusable(w)).toEqual([grukk, lirael, f]);
    expect(infuse(w, data, f.id, snag.id)).toEqual({
      ok: false,
      reason: 'No one can give that member hit points.',
    });
    hp(grukk, 30);
    // The giver is whoever has the most to spare, wherever they stand in the party.
    hp(snag, 20);
    hp(lirael, 2);
    expect(infuse(w, data, f.id, lirael.id)).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('from Grukk into Lirael');
    expect(infuse(w, data, snag.id, lirael.id)).toMatchObject({ ok: false });
    w.encounter = encounter([['thug-or-militia']]);
    expect(infuse(w, data, f.id, lirael.id)).toEqual({
      ok: false,
      reason: 'Settle the encounter first.',
    });
  });

  it('notes an escape behind the Invincible Citadel', () => {
    const w = world();
    w.encounter = encounter([['thug-or-militia']]);
    const fight = encounterBattle(w, data);
    fight.battle.escaped = true;
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'draw', rounds: 2, deaths: 0, battle: fight.battle },
      null,
    );
    expect(w.log).toContainEqual(expect.stringContaining('shelters in the Invincible Citadel'));
  });
});
