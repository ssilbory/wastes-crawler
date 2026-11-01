import { describe, expect, it } from 'vitest';
import { leaveCorpses } from '../../../src/game/world/necromancy.ts';
import { cannotCast, castLevel, spellReady, spendCast } from '../../../src/game/world/casting.ts';
import { endQuarter } from '../../../src/game/world/end-quarter.ts';
import { fightScribable, scribable } from '../../../src/game/world/scribing.ts';
import { outsideScrolls, unrollScroll } from '../../../src/game/world/scroll-reading.ts';
import { queryTheSkull, QUERY_THE_SKULL } from '../../../src/game/world/skull.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { castsLeftFor } from '../../../src/render/casting-view.ts';
import { necromancyView } from '../../../src/render/necromancy-view.ts';
import { greenwoodView } from '../../../src/render/greenwood-view.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { encounter } from './helpers.ts';
import { data, member, world } from './helpers.ts';

// docs/rules-adaptation.md, Scrolls outside fights in Phase 21.
const fail = (reason: string) => ({ ok: false, reason });
const SCROLL = data.content.scrolls.scroll.id;
const notes = (w: World) => w.log.map((l) => l.replace(/^Day \d+, \w+: /, ''));

/** Snag, no caster, carrying a scroll of `spell` at `level`, and nothing else magic. */
function reader(spell = QUERY_THE_SKULL, level = 3): { w: World; snag: Member } {
  const w = world();
  const snag = member(w, 'Snag');
  snag.character = {
    ...snag.character,
    inventory: [
      ...snag.character.inventory,
      { id: SCROLL, quantity: 1, location: 'stowed', spell, casterLevel: level },
    ],
  };
  return { w, snag };
}

const scrollLine = (m: Member) => m.character.inventory.findIndex((e) => e.id === SCROLL);
const withMagic = (m: Member, level: number) => {
  m.character = { ...m.character, skills: { ...m.character.skills, magic: level } };
};

describe('what fits on a scroll', () => {
  it('takes spells cast outside fights, which wands and staves still never hold', () => {
    const ids = scribable(data).map((s) => s.id);
    expect(ids).toContain(QUERY_THE_SKULL);
    expect(ids).toContain('obnubilation-of-the-will');
    expect(fightScribable(data).map((s) => s.id)).not.toContain(QUERY_THE_SKULL);
    expect(ids).toEqual(expect.arrayContaining(fightScribable(data).map((s) => s.id)));
  });
});

describe('reading a scroll outside a fight', () => {
  it('lists only scrolls of spells cast outside fights', () => {
    const { snag } = reader();
    snag.character = {
      ...snag.character,
      inventory: [
        ...snag.character.inventory,
        { id: SCROLL, quantity: 1, location: 'stowed', spell: 'the-howl-of-light', casterLevel: 5 },
      ],
    };
    expect(outsideScrolls(data, snag)).toEqual([
      { item: scrollLine(snag), spell: QUERY_THE_SKULL },
    ]);
  });

  it('holds the spell, safely with Magic at least its level less one', () => {
    const { w, snag } = reader();
    withMagic(snag, 3);
    w.rng = scriptedRng([]);
    expect(unrollScroll(w, data, snag.id, scrollLine(snag))).toEqual({ ok: true });
    expect(snag.unrolled).toEqual({ spell: QUERY_THE_SKULL, level: 3 });
    expect(scrollLine(snag)).toBe(-1);
    expect(notes(w).at(-1)).toContain("Query the Skull is Snag's to cast");
  });

  it('takes a Magic check otherwise, and fizzles on a miss, the scroll spent either way', () => {
    const { w, snag } = reader();
    w.rng = scriptedRng([1, 1]);
    expect(unrollScroll(w, data, snag.id, scrollLine(snag))).toEqual({ ok: true });
    expect(snag.unrolled ?? null).toBeNull();
    expect(notes(w).at(-1)).toBe('The spell fizzles.');
    expect(scrollLine(snag)).toBe(-1);
    const second = reader();
    second.w.rng = scriptedRng([6, 6]);
    unrollScroll(second.w, data, second.snag.id, scrollLine(second.snag));
    expect(second.snag.unrolled).toEqual({ spell: QUERY_THE_SKULL, level: 3 });
  });

  it('refuses in an encounter, for the fallen, for other lines, and while a spell is held', () => {
    const { w, snag } = reader();
    const line = scrollLine(snag);
    expect(unrollScroll(w, data, 'nobody', line)).toEqual(fail('No one is able to read that.'));
    expect(unrollScroll(w, data, snag.id, 0)).toEqual(
      fail('That is no scroll of a spell cast outside a fight.'),
    );
    snag.unrolled = { spell: 'raise-corpse', level: 2 };
    expect(unrollScroll(w, data, snag.id, line)).toEqual(
      fail('Snag already holds a spell read from a scroll.'),
    );
    w.encounter = encounter([['thug-or-militia']]);
    expect(unrollScroll(w, data, snag.id, line)).toEqual(fail('Settle the encounter first.'));
  });
});

describe('a spell held from a scroll', () => {
  it('is cast as if prepared, at the scroll’s level, and spent with no slot', () => {
    const { w, snag } = reader(QUERY_THE_SKULL, 2);
    expect(cannotCast(data, snag, QUERY_THE_SKULL)).toMatch(/prepared/);
    expect(spellReady(snag, QUERY_THE_SKULL)).toBe(false);
    snag.unrolled = { spell: QUERY_THE_SKULL, level: 2 };
    expect(cannotCast(data, snag, QUERY_THE_SKULL)).toBeNull();
    expect(spellReady(snag, QUERY_THE_SKULL)).toBe(true);
    expect(castLevel(snag, QUERY_THE_SKULL)).toBe(2);
    expect(castLevel(snag, 'raise-corpse')).toBe(1);
    // Query the Skull from the scroll: two questions at its level 2, not three.
    leaveCorpses(w, data, [['thug-or-militia']]);
    expect(queryTheSkull(w, data, snag.id, ['land', 'land', 'land'])).toMatchObject({ ok: true });
    expect(snag.unrolled).toBeNull();
    snag.unrolled = { spell: QUERY_THE_SKULL, level: 2 };
    spendCast(data, snag, QUERY_THE_SKULL);
    expect([snag.unrolled, snag.spellsCast]).toEqual([null, 0]);
  });

  it('is lost when the quarter ends', () => {
    const { w, snag } = reader();
    snag.unrolled = { spell: QUERY_THE_SKULL, level: 3 };
    endQuarter(w, data);
    expect(snag.unrolled).toBeNull();
  });

  it('shows in the spell panels of a member with no magic of their own', () => {
    const { w, snag } = reader();
    expect(castsLeftFor(snag, null)).toBe('');
    expect(necromancyView(w, data)?.casters.find((c) => c.id === snag.id)).toBeUndefined();
    snag.unrolled = { spell: QUERY_THE_SKULL, level: 3 };
    expect(castsLeftFor(snag, null)).toBe('a spell read from a scroll');
    expect(necromancyView(w, data)?.casters.find((c) => c.id === snag.id)).toMatchObject({
      left: 'a spell read from a scroll',
      query: { ask: 3 },
      raise: false,
    });
    expect(greenwoodView(w, data).find((c) => c.id === snag.id)).toBeUndefined();
    snag.unrolled = { spell: 'rouse-the-sapling', level: 4 };
    expect(greenwoodView(w, data).find((c) => c.id === snag.id)).toMatchObject({
      left: 'a spell read from a scroll',
    });
  });
});
