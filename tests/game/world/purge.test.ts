import { describe, expect, it } from 'vitest';
import type { PendingEncounter } from '../../../src/data/schemas/index.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { frailAllies, purgeFrailty } from '../../../src/game/world/purge.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { purgeView } from '../../../src/render/purge-view.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

/** Fizzwick as a level-8 Priest of Death with Heal-1 and Purge Ailment. */
function healer(w: World, arts = ['healing-touch', 'purge-ailment']): Member {
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

/** A world whose checks roll the given 2d6 faces, with Snag Frail. */
function frailSnag(faces: number[]): { w: World; h: Member; snag: Member } {
  const w = world();
  w.rng = scriptedRng(faces);
  const snag = member(w, 'Snag');
  snag.frail = true;
  return { w, h: healer(w), snag };
}

const fail = (reason: string) => ({ ok: false, reason });

describe('Purge Ailment lifting Frailty', () => {
  it('lifts an ally’s Frailty on a Heal check against 8, for a point of day Effort', () => {
    const { w, h, snag } = frailSnag([6, 6]);
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual({ ok: true });
    expect(snag.frail).toBe(false);
    expect(h.effortDay).toBe(1);
    expect(w.log.at(-1)).toMatch(/Fizzwick purges Snag's Frailty\./);
  });

  it('spends the Effort on a failed check and leaves the Frailty', () => {
    const { w, h, snag } = frailSnag([1, 1]);
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual({ ok: true });
    expect(snag.frail).toBe(true);
    expect(h.effortDay).toBe(1);
    expect(w.log.at(-1)).toMatch(/the Frailty holds/);
  });

  it('tends only living Frail allies, never the Healer themself', () => {
    const { w, h, snag } = frailSnag([]);
    const grukk = member(w, 'Grukk');
    grukk.frail = true;
    grukk.dead = true;
    h.frail = true;
    expect(frailAllies(w, h.id)).toEqual([snag]);
    const choose = fail('Choose an ally who is Frail.');
    expect(purgeFrailty(w, data, h.id, h.id)).toEqual(choose);
    expect(purgeFrailty(w, data, h.id, grukk.id)).toEqual(choose);
    expect(purgeFrailty(w, data, h.id, member(w, 'Lirael').id)).toEqual(choose);
    expect(h.effortDay).toBe(0);
  });

  it('needs a conscious Healer who knows the art and has Effort left', () => {
    const { w, h, snag } = frailSnag([]);
    expect(purgeFrailty(w, data, 'nobody', snag.id)).toEqual(
      fail('No one is able to purge an ailment.'),
    );
    h.character = { ...h.character, arts: ['healing-touch'] };
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual(
      fail("Fizzwick doesn't know Purge Ailment."),
    );
    healer(w);
    h.effortDay = (characterSheet(h.character, data).magic as { effort: number }).effort;
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual(
      fail('Fizzwick has no Effort left today.'),
    );
    h.effortDay = 0;
    h.character = { ...h.character, hp: { ...h.character.hp, current: 0 } };
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual(
      fail('No one is able to purge an ailment.'),
    );
    expect(snag.frail).toBe(true);
  });

  it('tends an ally lying unconscious after a revive', () => {
    const { w, h, snag } = frailSnag([6, 6]);
    snag.reviving = true;
    expect(frailAllies(w, h.id)).toEqual([snag]);
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual({ ok: true });
    expect(snag.frail).toBe(false);
  });

  it('works in armor, but not for a tradition without armored arts', () => {
    const { w, snag } = frailSnag([6, 6]);
    const grukk = member(w, 'Grukk');
    // Grukk wears armor; as a Priest of Death his Healer arts still work.
    grukk.character = {
      ...grukk.character,
      classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 8 } },
      skills: { ...grukk.character.skills, heal: 1 },
      arts: ['healing-touch', 'purge-ailment'],
      spells: { known: [], prepared: [] },
    };
    expect(characterSheet(grukk.character, data).magic?.canCast).toBe(false);
    const plain = {
      ...data,
      content: {
        ...data.content,
        traditions: data.content.traditions.map((t) => ({ ...t, armoredArts: false })),
      },
    };
    expect(purgeFrailty(w, plain, grukk.id, snag.id)).toEqual(
      fail("Grukk can't use that art in armor."),
    );
    expect(purgeFrailty(w, data, grukk.id, snag.id)).toEqual({ ok: true });
    expect(snag.frail).toBe(false);
  });

  it('waits until an encounter is settled', () => {
    const { w, h, snag } = frailSnag([]);
    w.encounter = {} as PendingEncounter;
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual(fail('Settle the encounter first.'));
    expect(h.effortDay).toBe(0);
  });
});

describe('the Purge Ailment panel view', () => {
  it('lists conscious Healers with the art, their Effort, and the Frail allies', () => {
    const { w, h, snag } = frailSnag([]);
    const effort = (characterSheet(h.character, data).magic as { effort: number }).effort;
    h.effortDay = 1;
    expect(purgeView(w, data)).toEqual({
      healers: [
        {
          id: h.id,
          name: 'Fizzwick',
          effortLeft: effort - 1,
          frail: [{ id: snag.id, name: 'Snag' }],
        },
      ],
    });
  });

  it('is empty with no one Frail, no Healer with the art, or the Healer down', () => {
    const { w, h, snag } = frailSnag([]);
    snag.frail = false;
    expect(purgeView(w, data)).toBeNull();
    snag.frail = true;
    h.character = { ...h.character, hp: { ...h.character.hp, current: 0 } };
    expect(purgeView(w, data)).toBeNull();
    const plain = world();
    member(plain, 'Snag').frail = true;
    expect(purgeView(plain, data)).toBeNull();
  });
});
