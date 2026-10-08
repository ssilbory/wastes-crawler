import { describe, expect, it } from 'vitest';
import type { Trap } from '../../../src/data/schemas/index.ts';
import { blind, burn, faithLit, inDark } from '../../../src/game/dungeon/light.ts';
import { springHere } from '../../../src/game/dungeon/traps.ts';
import {
  artUsable,
  bonetalker,
  immuneTo,
  mercy,
  sacredBlood,
  seer,
  tended,
  vigor,
} from '../../../src/game/world/arts.ts';
import { campUnderground } from '../../../src/game/dungeon/time.ts';
import { camp } from '../../../src/game/world/activities.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { startEncounter } from '../../../src/game/world/encounters.ts';
import { applyBattle, battleFrom, partySetup } from '../../../src/game/world/fight.ts';
import { endQuarter } from '../../../src/game/world/quarter.ts';
import { passTurn } from '../../../src/game/dungeon/time.ts';
import { setHp } from '../../../src/game/world/members.ts';
import { parley } from '../../../src/game/world/parley.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { below, place } from '../dungeon/helpers.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Fizzwick in a class with these arts and Effort to spare. */
function gift(w: World, arts: string[], classId = 'blood-priest-partial-warrior'): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: classId, levels: { [classId]: 3 } },
    skills: { ...m.character.skills, pray: 1, heal: 1, magic: 1 },
    arts,
    spells: { known: [], prepared: [] },
  };
  return m;
}

describe('using arts outside combat (Phase 15)', () => {
  it('needs the art, a conscious holder, Effort left, and armor that allows it', () => {
    const w = world();
    const fizz = gift(w, ['flamesight'], 'full-elementalist');
    expect(artUsable(data, fizz, 'flamesight')).toBe(true);
    expect(artUsable(data, fizz, 'earthsight')).toBe(false);
    fizz.effortDay = 9;
    expect(artUsable(data, fizz, 'flamesight')).toBe(false);
    fizz.effortDay = 0;
    fizz.reviving = true;
    expect(artUsable(data, fizz, 'flamesight')).toBe(false);
    fizz.reviving = false;
    // Snag's armor blocks an Elementalist's arts; a non-caster has none.
    const snag = member(w, 'Snag');
    snag.character = { ...snag.character, classes: fizz.character.classes, arts: ['flamesight'] };
    expect(artUsable(data, snag, 'flamesight')).toBe(false);
    const grukk = member(w, 'Grukk');
    grukk.character = { ...grukk.character, arts: ['flamesight'] };
    expect(artUsable(data, grukk, 'flamesight')).toBe(false);
  });
});

describe('sight and Light of Faith underground', () => {
  it('lets a seer spot, search, and map in the dark', () => {
    const w = below();
    w.light.lit = null;
    expect(blind(w, data)).toBe(true);
    gift(w, ['flamesight'], 'full-elementalist');
    expect(seer(w, data)).toBe(true);
    expect(inDark(w, data)).toBe(true);
    expect(blind(w, data)).toBe(false);
  });

  it('lights the party with no torch burning, and commits the priest’s Effort in a fight', () => {
    const w = below();
    const lit = w.light.torch;
    gift(w, ['the-light-of-faith']);
    expect(faithLit(w, data)).toBe(true);
    w.light.lit = null;
    expect(inDark(w, data)).toBe(false);
    w.light.lit = 'torch';
    burn(w, data);
    expect(w.light.torch).toBe(lit);
    const setup = partySetup(w, data, [['thug-or-militia']], false);
    expect(setup.dark).toBe(false);
    expect(setup.party.map((p) => p.committed)).toEqual([0, 0, 0, 1]);
    const b = battleFrom(data, createRng('faith'), setup, false);
    expect(b.combatants[3]?.caster?.effortUsed).toBe(1);
    expect(faithLit(world(), data)).toBe(false);
  });
});

describe('the night’s privations', () => {
  it('keep off Cold, Sleepless, and Hungry as each art allows', () => {
    const w = world();
    const fizz = gift(w, ['elemental-resilience'], 'full-elementalist');
    expect(immuneTo(data, fizz, 'cold')).toBe(true);
    expect(immuneTo(data, fizz, 'sleepless')).toBe(false);
    gift(w, ['wizards-grandeur'], 'full-high-mage');
    expect(immuneTo(data, fizz, 'cold')).toBe(true);
    gift(w, ['cold-flesh'], 'full-necromancer');
    expect(immuneTo(data, fizz, 'sleepless')).toBe(true);
    expect(immuneTo(data, fizz, 'hungry')).toBe(false);
    gift(w, ['tireless-vigor'], 'healer-partial-mage');
    expect(immuneTo(data, fizz, 'hungry')).toBe(true);
    expect(immuneTo(data, fizz, 'sleepless')).toBe(true);
    expect(immuneTo(data, member(w, 'Snag'), 'cold')).toBe(false);
  });

  it('spare the immune at day’s end', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    gift(w, ['tireless-vigor'], 'healer-partial-mage');
    w.rations = 0;
    w.rng = createRng('night');
    endOfDay(w, data);
    expect(member(w, 'Fizzwick')).toMatchObject({ hungry: false, sleepless: false });
    expect(member(w, 'Snag')).toMatchObject({ hungry: true, sleepless: true });
  });
});

describe('Transubstantiation', () => {
  it('feeds the party at day’s end in place of the rations, and heals each', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    const fizz = gift(w, ['transubstantiation']);
    setHp(member(w, 'Snag'), 1);
    w.rations = 0;
    w.rng = scriptedRng([3, 3, 3, 3]);
    expect(sacredBlood(w, data)).toBe(true);
    expect(member(w, 'Snag').character.hp.current).toBe(5);
    expect(fizz.effortDay).toBe(1);
    // Fed by blood, no one goes hungry though the rations are gone.
    const v = world();
    v.position = { col: 5, row: 9 };
    gift(v, ['transubstantiation']);
    v.rations = 0;
    v.rng = createRng('blood');
    endOfDay(v, data);
    expect(member(v, 'Snag').hungry).toBe(false);
    expect(sacredBlood(world(), data)).toBe(false);
    // Without Pray, the blood heals the die alone.
    const u = world();
    const priest = gift(u, ['transubstantiation']);
    const skills = { ...priest.character.skills };
    delete skills.pray;
    priest.character = { ...priest.character, skills };
    setHp(member(u, 'Snag'), 1);
    u.rng = scriptedRng([3, 3, 3, 3]);
    sacredBlood(u, data);
    expect(member(u, 'Snag').character.hp.current).toBe(4);
  });
});

describe('Words of Mercy', () => {
  it('rerolls a failed plea for peace for day Effort', () => {
    const w = world([1, 1, 6, 6]);
    w.position = { col: 5, row: 9 };
    const fizz = gift(w, ['words-of-mercy']);
    w.encounter = encounter([['thug-or-militia']]);
    expect(parley(w, data, 'talk', member(w, 'Lirael').id)).toEqual({ ok: true });
    expect(w.encounter?.reaction).toBe('friendly');
    expect(fizz.effortDay).toBe(1);
    expect(w.log.join('\n')).toContain('Fizzwick speaks words of mercy.');
    expect(mercy(world(), data)).toBeUndefined();
  });
});

describe('Bonetalker', () => {
  it('lets mindless undead pass a party whose Necromancer speaks to them', () => {
    const w = world();
    gift(w, ['bonetalker'], 'full-necromancer');
    const e = encounter([['zombie']], { hostile: true });
    bonetalker(w, data, e);
    expect(e.hostile).toBe(false);
    // Not with the living among them, nor with the peaceful.
    const mixed = encounter([['zombie', 'thug-or-militia']], { hostile: true });
    bonetalker(w, data, mixed);
    expect(mixed.hostile).toBe(true);
    const plain = encounter([['zombie']], { hostile: true });
    bonetalker(world(), data, plain);
    expect(plain.hostile).toBe(true);
    // Random encounters ask it.
    w.rng = createRng('dead');
    startEncounter(
      w,
      data,
      { rows: [['zombie']], nature: 'hostile', captive: null },
      undefined,
      null,
      'here',
    );
    expect(w.encounter?.hostile).toBe(false);
  });
});

describe('Refined Restoration and Unaging', () => {
  it('takes one more strain off each sleeper a Healer tends, once a night', () => {
    const night = (refined: boolean, slept: boolean) => {
      const w = world();
      if (refined) gift(w, ['refined-restoration'], 'healer-partial-mage');
      expect(tended(w)).toBe(refined);
      const snag = member(w, 'Snag');
      snag.character = { ...snag.character, strain: { value: 3, broken: false } };
      snag.slept = slept;
      w.rng = createRng('night');
      endOfDay(w, data);
      return member(w, 'Snag').character.strain.value;
    };
    expect(night(true, true)).toBe(2);
    // Only a good night's rest: the Sleepless take their strain and get no care.
    expect(night(true, false)).toBe(4);
    expect(night(false, true)).toBe(3);
  });

  it('leaves each quarter of rest at 1 strain, above ground and below', () => {
    const under = place(below(), 'barrow-upper', 4, 0, 'n');
    const o = world();
    o.position = { col: 5, row: 9 };
    for (const w of [under, o]) {
      gift(w, ['refined-restoration'], 'healer-partial-mage');
      const snag = member(w, 'Snag');
      snag.character = { ...snag.character, strain: { value: 3, broken: false } };
      snag.artUses = { 'swift-healer': 1 };
      w.rng = createRng('camp');
    }
    campUnderground(under, data, { [member(under, 'Snag').id]: 'sleep' });
    camp(o, data, { [member(o, 'Snag').id]: 'sleep', [member(o, 'Grukk').id]: 'rest' });
    expect(member(under, 'Snag').character.strain.value).toBe(2);
    expect(member(o, 'Snag').character.strain.value).toBe(2);
    expect(member(o, 'Snag').artUses).toEqual({});
  });

  it('turns trap poison aside from the unaging', () => {
    const poison = {
      ...data,
      content: {
        ...data.content,
        dungeons: data.content.dungeons.map((d) => ({
          ...d,
          levels: d.levels.map((l) => ({
            ...l,
            traps: l.traps.map((t): Trap => ({ ...t, save: null, effect: { kind: 'poison' } })),
          })),
        })),
      },
    };
    const w = place(below(), 'barrow-upper', 4, 6, 'n');
    const fizz = gift(w, ['unaging'], 'full-necromancer');
    const hp = fizz.character.hp.current;
    springHere(w, poison);
    expect(fizz.character.hp.current).toBe(hp);
    expect(w.log.join('\n')).toContain('The poison does nothing to Fizzwick.');
  });
});

describe('Tireless Vigor’s regeneration', () => {
  it('heals 1 after a fight, 1 every 10 dungeon turns, and 5 a quarter, up to the maximum', () => {
    const w = world();
    w.position = { col: 5, row: 9 };
    const fizz = gift(w, ['tireless-vigor'], 'healer-partial-mage');
    const max = fizz.character.hp.max;
    setHp(fizz, 1);
    setHp(member(w, 'Snag'), 1);
    vigor(w, data, 1);
    expect(fizz.character.hp.current).toBe(2);
    expect(member(w, 'Snag').character.hp.current).toBe(1);
    vigor(w, data, 100);
    expect(fizz.character.hp.current).toBe(max);
    // A quarter on the overland map.
    setHp(fizz, 1);
    endQuarter(w, data);
    expect(fizz.character.hp.current).toBe(Math.min(max, 6));
    // Ten turns underground.
    const d = below();
    const h = gift(d, ['tireless-vigor'], 'healer-partial-mage');
    setHp(h, 1);
    // The tenth turn heals, before any wanderers come.
    (d.dungeon as NonNullable<typeof d.dungeon>).turn = 9;
    d.rng = createRng('turns');
    passTurn(d, data);
    expect(h.character.hp.current).toBe(2);
    passTurn(d, data);
    expect(h.character.hp.current).toBe(2);
    // After a won fight.
    const f = world();
    const g = gift(f, ['tireless-vigor'], 'healer-partial-mage');
    setHp(g, 1);
    const fight = {
      battle: { combatants: [] } as never,
      setup: null as never,
      memberIds: [],
      npcIds: [],
      enemies: [['thug-or-militia']],
      captive: null,
      quest: null,
      garrison: null,
      patrol: null,
    };
    applyBattle(
      f,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: null as never },
      null,
    );
    expect(g.character.hp.current).toBe(2);
  });
});
