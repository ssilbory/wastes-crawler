import { describe, expect, it } from 'vitest';
import {
  cannotRaise,
  cannotRaiseKnight,
  leaveCorpses,
  raiseCorpse,
} from '../../src/game/world/necromancy.ts';
import type { Member, World } from '../../src/game/world/types.ts';
import { deadOffer } from '../../src/render/dead-view.ts';
import { idleLine } from '../../src/render/idle-view.ts';
import { data, encounter, member, world } from '../game/world/helpers.ts';

/** Fizzwick as a Necromancer with the given spells prepared. */
function necromancer(w: World, spells: string[], level = 3): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-necromancer', levels: { 'full-necromancer': level } },
    spells: { known: spells, prepared: spells },
    arts: ['bonetalker'],
  };
  return m;
}

const BOTH = ['query-the-skull', 'raise-corpse'];

describe('deadOffer', () => {
  it('offers nothing with no corpses, or no one to use them', () => {
    const w = world();
    necromancer(w, BOTH);
    expect(deadOffer(w, data)).toBeNull();
    const plain = world();
    leaveCorpses(plain, data, [['thug-or-militia']]);
    expect(deadOffer(plain, data)).toBeNull();
  });

  it('offers questioning and raising to a caster with both prepared', () => {
    const w = world();
    const m = necromancer(w, BOTH);
    leaveCorpses(w, data, [['thug-or-militia', 'thug-or-militia']]);
    const offer = deadOffer(w, data);
    expect(offer?.corpses).toBe(2);
    expect(offer?.query.map((c) => c.id)).toEqual([m.id]);
    expect(offer?.raise).toMatchObject([{ corpse: true, knight: false }]);
  });

  it('offers only what is prepared', () => {
    const w = world();
    necromancer(w, ['raise-corpse']);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(deadOffer(w, data)?.query).toEqual([]);
    expect(deadOffer(w, data)?.raise).toHaveLength(1);
  });

  it('drops questioning once the dead have spoken', () => {
    const w = world();
    necromancer(w, BOTH);
    leaveCorpses(w, data, [['thug-or-militia']]);
    (w.corpses as NonNullable<World['corpses']>).queried = true;
    expect(deadOffer(w, data)?.query).toEqual([]);
    expect(deadOffer(w, data)?.raise).toHaveLength(1);
  });

  it('offers nothing to a caster out of spells, or while an encounter is up', () => {
    const w = world();
    const m = necromancer(w, BOTH);
    leaveCorpses(w, data, [['thug-or-militia']]);
    w.encounter = encounter([['thug-or-militia']]);
    expect(deadOffer(w, data)).toBeNull();
    w.encounter = null;
    m.spellsCast = 99;
    m.pointsSpent = 99;
    expect(deadOffer(w, data)).toBeNull();
  });

  it('drops raising when the party has no room for another', () => {
    const w = world();
    const m = necromancer(w, ['raise-corpse']);
    leaveCorpses(w, data, [['thug-or-militia', 'thug-or-militia', 'thug-or-militia']]);
    for (const form of ['skeleton', 'zombie'] as const) {
      expect(cannotRaise(w, data, m)).toBeNull();
      expect(raiseCorpse(w, data, m.id, form)).toEqual({ ok: true });
      m.spellsCast = 0;
      m.pointsSpent = 0;
    }
    expect(cannotRaise(w, data, m)).toBe('There is no room in the party.');
    expect(deadOffer(w, data)).toBeNull();
  });
});

describe('deadOffer and the Grave Knight', () => {
  it('offers a Grave Knight over a corpse of 4 hit dice', () => {
    const w = world();
    necromancer(w, ['raise-grave-knight'], 10);
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(deadOffer(w, data)).toBeNull();
    (w.corpses as NonNullable<World['corpses']>).hitDice = [4];
    expect(deadOffer(w, data)?.raise).toMatchObject([{ corpse: false, knight: true }]);
  });
});

describe('cannotRaise and cannotRaiseKnight', () => {
  it('want a corpse, and a Grave Knight one of 4 hit dice', () => {
    const w = world();
    const m = necromancer(w, ['raise-corpse', 'raise-grave-knight'], 10);
    expect(cannotRaise(w, data, m)).toBe('There are no corpses here.');
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(cannotRaise(w, data, m)).toBeNull();
    expect(cannotRaiseKnight(w, data, m)).toBe('There is no corpse of 4 hit dice or more here.');
  });

  it('refuse a member without the spell', () => {
    const w = world();
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(cannotRaise(w, data, member(w, 'Snag'))).toMatch(/hasn't prepared/);
    expect(cannotRaise(w, data, undefined)).toBe('No one is able to cast that.');
  });
});

describe('idleLine', () => {
  const healer = (w: World, arts: string[]) => {
    const m = member(w, 'Fizzwick');
    m.character = {
      ...m.character,
      classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 8 } },
      spells: { known: [], prepared: [] },
      arts,
    };
    return m;
  };

  it('says nothing for a party without the power', () => {
    const w = world();
    expect(idleLine(w, data, 'revive')).toBeNull();
    expect(idleLine(w, data, 'purge')).toBeNull();
    expect(idleLine(w, data, 'conjunct')).toBeNull();
  });

  it('names the healer while no one needs them', () => {
    const w = world();
    healer(w, ['healing-touch', 'revive-the-fallen', 'purge-ailment']);
    expect(idleLine(w, data, 'revive')).toMatch(
      /^Fizzwick can revive .* No one has fallen here\.$/,
    );
    expect(idleLine(w, data, 'purge')).toMatch(/^Fizzwick can purge .* is ailing\.$/);
  });

  it('names every healer the party has', () => {
    const w = world();
    healer(w, ['healing-touch', 'purge-ailment']);
    member(w, 'Snag').character.arts = ['purge-ailment'];
    expect(idleLine(w, data, 'purge')).toMatch(/^(Snag and Fizzwick|Fizzwick and Snag) can purge/);
  });

  it('gives way to the panel once someone needs tending, and to an encounter', () => {
    const w = world();
    healer(w, ['healing-touch', 'purge-ailment']);
    member(w, 'Snag').frail = true;
    expect(idleLine(w, data, 'purge')).toBeNull();
    member(w, 'Snag').frail = false;
    w.encounter = encounter([['thug-or-militia']]);
    expect(idleLine(w, data, 'purge')).toBeNull();
  });

  it('names a caster of Conjunct the Vital Viscera while no one is hurt', () => {
    const w = world();
    const m = member(w, 'Fizzwick');
    m.character.spells = {
      known: ['conjunct-the-vital-viscera'],
      prepared: ['conjunct-the-vital-viscera'],
    };
    expect(idleLine(w, data, 'conjunct')).toMatch(/^Fizzwick can pass hit points/);
    const snag = member(w, 'Snag').character;
    snag.hp.current = 1;
    expect(idleLine(w, data, 'conjunct')).toBeNull();
  });
});
