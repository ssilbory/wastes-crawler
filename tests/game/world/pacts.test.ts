import { describe, expect, it } from 'vitest';
import type { GameData } from '../../../src/game/character/context.ts';
import { springHere } from '../../../src/game/dungeon/traps.ts';
import { applyBattle, partySetup, type WorldBattle } from '../../../src/game/world/fight.ts';
import { endPacts, makePact, PACT, pactOf } from '../../../src/game/world/pacts.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { below, place } from '../dungeon/helpers.ts';
import { fail } from './helpers-mage.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Fizzwick as a level-`level` Elementalist with Pact of Stone and Sea prepared. */
function elementalist(w: World, level = 3): Member {
  const m = member(w, 'Fizzwick');
  m.character = {
    ...m.character,
    classes: { current: 'full-elementalist', levels: { 'full-elementalist': level } },
    spells: { known: [PACT], prepared: [PACT] },
  };
  return m;
}

/** The barrow's dart trap made of earth, for the test. */
const earthen: GameData = {
  ...data,
  content: {
    ...data.content,
    dungeons: data.content.dungeons.map((d) =>
      d.id !== 'old-barrow'
        ? d
        : {
            ...d,
            levels: d.levels.map((l) => ({
              ...l,
              traps: l.traps.map((t) => ({ ...t, element: 'earth' as const })),
            })),
          },
    ),
  },
};

describe('Pact of Stone and Sea', () => {
  it('binds a living member to an element for the scene', () => {
    const w = world();
    const m = elementalist(w);
    const snag = member(w, 'Snag');
    expect(makePact(w, data, m.id, snag.id, 'fire')).toEqual({ ok: true });
    m.spellsCast = 0;
    expect(makePact(w, data, m.id, m.id, 'water')).toEqual({ ok: true });
    expect([pactOf(w, snag.id), pactOf(w, m.id), pactOf(w, 'm-1')]).toEqual([
      'fire',
      'water',
      undefined,
    ]);
    expect(w.log.at(-1)).toContain('Fizzwick binds Fizzwick in a pact with water.');
  });

  it('ends with the day, the level, or the next fight', () => {
    const w = world();
    const m = elementalist(w);
    makePact(w, data, m.id, m.id, 'fire');
    w.day = 1;
    expect(pactOf(w, m.id)).toBeUndefined();
    const d = below();
    const n = elementalist(d);
    makePact(d, data, n.id, n.id, 'earth');
    expect(pactOf(d, n.id)).toBe('earth');
    place(d, 'barrow-lower', 0, 0, 's');
    expect(pactOf(d, n.id)).toBeUndefined();
    place(d, 'barrow-upper', 1, 8, 'n');
    expect(pactOf(d, n.id)).toBe('earth');
    d.dungeon = null;
    expect(pactOf(d, n.id)).toBeUndefined();
    endPacts(d);
    expect(d.pacts).toBeNull();
  });

  it('wards off a trap of its element, and nothing else', () => {
    const w = place(below(), 'barrow-upper', 4, 6, 'n');
    const m = elementalist(w);
    const snag = member(w, 'Snag');
    makePact(w, earthen, m.id, snag.id, 'earth');
    for (const x of w.members) x.character.hp = { max: 50, current: 50 };
    // Everyone saves first: Grukk, Lirael, and Fizzwick fail and take 3 each; Snag rolls nothing.
    w.rng = scriptedRng([2, 2, 2, 3, 3, 3]);
    springHere(w, earthen);
    expect(w.log.join('\n')).toContain("The dart trap can't harm Snag.");
    expect(w.members.map((x) => x.character.hp.current)).toEqual([50, 47, 47, 47]);
    const plain = place(below(), 'barrow-upper', 4, 6, 'n');
    const p = elementalist(plain);
    makePact(plain, data, p.id, member(plain, 'Snag').id, 'earth');
    for (const x of plain.members) x.character.hp = { max: 50, current: 50 };
    plain.rng = scriptedRng([2, 2, 2, 2, 3, 3, 3, 3]);
    springHere(plain, data);
    expect(member(plain, 'Snag').character.hp.current).toBe(47);
  });

  it('carries into a fight, which ends it', () => {
    const w = world();
    const m = elementalist(w);
    makePact(w, data, m.id, member(w, 'Snag').id, 'fire');
    const setup = partySetup(w, data, [['chimera']], false);
    expect(setup.party.map((p) => p.pact)).toEqual(['fire', null, null, null]);
    const fight = {
      battle: { combatants: [] } as never,
      setup: null as never,
      memberIds: [],
      npcIds: [],
      riddenIds: [],
      mountIds: [],
      enemies: [['thug-or-militia']],
      captive: null,
      quest: null,
      garrison: null,
      patrol: null,
    } satisfies WorldBattle;
    w.encounter = encounter([['thug-or-militia']]);
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: null as never },
      null,
    );
    expect(w.pacts).toBeNull();
  });

  it('is refused in an encounter, on the dead, or unprepared', () => {
    const w = world();
    const m = elementalist(w);
    const snag = member(w, 'Snag');
    w.encounter = encounter([['thug-or-militia']]);
    expect(makePact(w, data, m.id, snag.id, 'fire')).toEqual(fail('Settle the encounter first.'));
    w.encounter = null;
    snag.dead = true;
    expect(makePact(w, data, m.id, snag.id, 'fire')).toEqual(
      fail('Only a living member can be pacted.'),
    );
    expect(makePact(w, data, m.id, m.id, 'ice' as never)).toEqual(
      fail('Choose earth, water, fire, or wind.'),
    );
    m.character.spells.prepared = [];
    expect(makePact(w, data, m.id, m.id, 'fire')).toEqual(
      fail("Fizzwick hasn't prepared Pact of Stone and Sea."),
    );
    expect(m.spellsCast).toBe(0);
  });
});
