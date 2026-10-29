import { describe, expect, it } from 'vitest';
import type { Battle } from '../../../src/game/combat/types.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { applyBattle, type WorldBattle } from '../../../src/game/world/fight.ts';
import {
  fallenHere,
  recordFallen,
  reviveFallen,
  wakeRevived,
} from '../../../src/game/world/healer.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { healerView, leavingWarning, reviveOffered } from '../../../src/render/healer-view.ts';
import { data, member, world } from './helpers.ts';

/** Fizzwick as a level-8 Priest of Death with Heal-1 and Revive the Fallen. */
function healer(w: World, arts = ['healing-touch', 'revive-the-fallen']): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 8 } },
    skills: { ...m.character.skills, heal: 1 },
    arts,
    spells: { known: [], prepared: [] },
  };
  return m;
}

/** A battle whose combatants line up with the members, in the given states. */
const battleOf = (statuses: string[]) =>
  ({ combatants: statuses.map((status) => ({ status })) }) as unknown as Battle;

/** Snag slain in a fight just won, here. */
function slainSnag(w: World): Member {
  const snag = member(w, 'Snag');
  snag.dead = true;
  snag.character = { ...snag.character, hp: { ...snag.character.hp, current: 0 } };
  recordFallen(w, [snag.id, member(w, 'Grukk').id], battleOf(['dead', 'active']));
  return snag;
}

const fail = (reason: string) => ({ ok: false, reason });

describe('the fallen (Phase 14d)', () => {
  it('are those a fight killed, where it was fought, until the party moves on', () => {
    const w = world();
    expect(fallenHere(w)).toEqual([]);
    const snag = slainSnag(w);
    expect(w.fallen).toEqual({ at: 'borderlands/3,8', members: [snag.id] });
    expect(fallenHere(w)).toEqual([snag]);
    w.position = { col: 4, row: 8 };
    expect(fallenHere(w)).toEqual([]);
    // A fight that kills no one leaves no one to revive.
    recordFallen(w, [snag.id], battleOf(['active']));
    expect(w.fallen).toBeNull();
  });

  it('are recorded by every battle the party survives', () => {
    const w = world();
    const snag = member(w, 'Snag');
    const fight = {
      battle: battleOf(['dead']),
      setup: null as never,
      memberIds: [snag.id],
      npcIds: [],
      riddenIds: [],
      mountIds: [],
      enemies: [['thug-or-militia']],
      captive: null,
      quest: null,
      garrison: null,
      patrol: null,
    } satisfies WorldBattle;
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 2, deaths: 1, battle: null as never },
      null,
    );
    expect(w.fallen?.members).toEqual([snag.id]);
  });
});

describe('Revive the Fallen', () => {
  it('spends day Effort to bring one back at maximum strain, unconscious', () => {
    const w = world();
    const fizz = healer(w);
    const snag = slainSnag(w);
    snag.pendingXp = 1;
    expect(healerView(w, data)).toEqual({
      healers: [{ id: fizz.id, name: 'Fizzwick', effortLeft: 2, unable: null }],
      fallen: [{ id: snag.id, name: 'Snag' }],
    });
    expect(reviveFallen(w, data, fizz.id, snag.id)).toEqual({ ok: true });
    const max = characterSheet(snag.character, data).strainMax;
    expect(snag).toMatchObject({ dead: false, reviving: true, pendingXp: 0 });
    expect(snag.character.strain).toEqual({ value: max, broken: false });
    expect(snag.character.hp.current).toBe(0);
    expect(fizz.effortDay).toBe(1);
    expect(w.fallen?.members).toEqual([]);
    expect(healerView(w, data)).toBeNull();
    expect(w.log.at(-1)).toMatch(/Fizzwick revives Snag, who lies unconscious\.$/);
  });

  it('asks before moving on only while a Healer has Effort to revive', () => {
    const w = world();
    expect(reviveOffered(healerView(w, data))).toBe(false);
    const fizz = healer(w);
    slainSnag(w);
    expect(reviveOffered(healerView(w, data))).toBe(true);
    fizz.effortDay = 2;
    expect(healerView(w, data)?.healers[0]?.unable).toBe('Fizzwick has no Effort left today.');
    expect(reviveOffered(healerView(w, data))).toBe(false);
    expect(reviveOffered(null)).toBe(false);
  });

  it('warns that the fallen are lost for good once the party moves on', () => {
    const fallen = (...names: string[]) => ({
      healers: [],
      fallen: names.map((name) => ({ id: name, name })),
    });
    expect(leavingWarning(fallen('Snag'))).toBe('Once the party moves on, Snag is gone for good.');
    expect(leavingWarning(fallen('Snag', 'Grukk'))).toBe(
      'Once the party moves on, Snag and Grukk are gone for good.',
    );
    expect(leavingWarning(fallen('Snag', 'Grukk', 'Brom'))).toBe(
      'Once the party moves on, Snag, Grukk and Brom are gone for good.',
    );
  });

  it('wakes the revived with 1 hit point when the night passes, untouched by it', () => {
    const w = world();
    const snag = slainSnag(w);
    reviveFallen(w, data, healer(w).id, snag.id);
    endOfDay(w, data);
    expect(snag).toMatchObject({ reviving: false, hungry: false, sleepless: false });
    expect(snag.character.hp.current).toBe(1);
    expect(w.fallen).toBeNull();
    // Already healed by other means, they keep it.
    snag.reviving = true;
    snag.character = { ...snag.character, hp: { ...snag.character.hp, current: 5 } };
    wakeRevived(w);
    expect(snag.character.hp.current).toBe(5);
  });

  it('refuses without a able Healer, the art, Effort, or a fallen target here', () => {
    const w = world();
    const snag = slainSnag(w);
    expect(reviveFallen(w, data, 'nobody', snag.id)).toEqual(
      fail('No one is able to revive the fallen.'),
    );
    const fizz = healer(w, ['healing-touch']);
    expect(reviveFallen(w, data, fizz.id, snag.id)).toEqual(
      fail("Fizzwick doesn't know Revive the Fallen."),
    );
    healer(w);
    fizz.effortDay = 2;
    expect(reviveFallen(w, data, fizz.id, snag.id)).toEqual(
      fail('Fizzwick has no Effort left today.'),
    );
    fizz.effortDay = 0;
    expect(reviveFallen(w, data, fizz.id, member(w, 'Grukk').id)).toEqual(
      fail('Only those slain in the fight just won can be revived, where they fell.'),
    );
    fizz.dead = true;
    expect(reviveFallen(w, data, fizz.id, snag.id)).toEqual(
      fail('No one is able to revive the fallen.'),
    );
    fizz.dead = false;
    fizz.character = { ...fizz.character, hp: { ...fizz.character.hp, current: 0 } };
    expect(reviveFallen(w, data, fizz.id, snag.id).ok).toBe(false);
    expect(healerView(w, data)).toBeNull();
  });

  it('works in armor for the Healer, but not for a tradition that lacks it', () => {
    const w = world();
    const snag = slainSnag(w);
    const grukk = member(w, 'Grukk');
    // Grukk wears armor; as a Priest of Death his Healer arts still work.
    grukk.character = {
      ...grukk.character,
      classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 8 } },
      skills: { ...grukk.character.skills, heal: 1 },
      arts: ['healing-touch', 'revive-the-fallen'],
      spells: { known: [], prepared: [] },
    };
    expect(characterSheet(grukk.character, data).magic?.canCast).toBe(false);
    expect(reviveFallen(w, data, grukk.id, snag.id)).toEqual({ ok: true });
    // A tradition without armored arts (a test-only content change) is blocked.
    const plain = {
      ...data,
      content: {
        ...data.content,
        traditions: data.content.traditions.map((t) => ({ ...t, armoredArts: false })),
      },
    };
    const v = world();
    const fallen = slainSnag(v);
    const g = member(v, 'Grukk');
    g.character = grukk.character;
    expect(reviveFallen(v, plain, g.id, fallen.id)).toEqual(
      fail("Grukk can't use that art in armor."),
    );
    // The panel says so too, and doesn't ask before moving on.
    expect(healerView(v, plain)?.healers[0]?.unable).toBe("Grukk can't use that art in armor.");
    expect(reviveOffered(healerView(v, plain))).toBe(false);
  });
});
