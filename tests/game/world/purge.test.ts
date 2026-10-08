import { describe, expect, it } from 'vitest';
import type { PendingEncounter } from '../../../src/data/schemas/index.ts';
import { characterSheet } from '../../../src/game/character/derived.ts';
import { frailAllies, purgeFrailty } from '../../../src/game/world/purge.ts';
import { cureFrailty } from '../../../src/game/world/members.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
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
  it('lifts an ally’s Frailty on a Heal check against 10, for day Effort and 1 strain', () => {
    const { w, h, snag } = frailSnag([6, 6]);
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual({ ok: true });
    expect(snag.frail).toBe(false);
    expect(snag.purgeTries).toEqual([]);
    expect(snag.character.strain.value).toBe(1);
    expect(h.effortDay).toBe(1);
    expect(w.log.at(-1)).toMatch(/Fizzwick purges Snag's Frailty\./);
  });

  it('gives each Healer one try at each Frailty', () => {
    const { w, h, snag } = frailSnag([1, 1, 6, 6]);
    purgeFrailty(w, data, h.id, snag.id);
    expect(snag.purgeTries).toEqual([h.id]);
    expect(frailAllies(w, h.id)).toEqual([]);
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual(
      fail('Choose a Frail ally you haven’t tried to purge.'),
    );
    expect(h.effortDay).toBe(1);
    // Another Healer may still try.
    const grukk = member(w, 'Grukk');
    grukk.character = { ...h.character, name: 'Grukk' };
    expect(frailAllies(w, grukk.id)).toEqual([snag]);
    // A Frailty lifted any other way clears the tries, so a new one starts fresh.
    cureFrailty(snag);
    snag.frail = true;
    expect(frailAllies(w, h.id)).toEqual([snag]);
  });

  it('refuses an ally who can’t bear the strain, spending nothing', () => {
    const { w, h, snag } = frailSnag([6, 6]);
    const max = characterSheet(snag.character, data).strainMax;
    snag.character = { ...snag.character, strain: { value: max, broken: false } };
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual(fail("Snag can't bear more strain."));
    expect(h.effortDay).toBe(0);
    expect(snag.purgeTries).toEqual([]);
    expect(snag.frail).toBe(true);
  });

  it('spends the Effort on a failed check and leaves the Frailty', () => {
    const { w, h, snag } = frailSnag([1, 1]);
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual({ ok: true });
    expect(snag.frail).toBe(true);
    expect(snag.character.strain.value).toBe(1);
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
    const choose = fail('Choose a Frail ally you haven’t tried to purge.');
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

  it('rolls with the better of Wis and Int', () => {
    // 3 + 4 + Heal-1 is 8: Int 18 (+2) makes 10, Wis 3 (-2) would make 6.
    const { w, h, snag } = frailSnag([3, 4]);
    const base = { ...h.character.attributes.base, wis: 3, int: 18 };
    h.character = {
      ...h.character,
      attributes: { base, people: {}, background: {}, advancement: {} },
    };
    expect(purgeFrailty(w, data, h.id, snag.id)).toEqual({ ok: true });
    expect(snag.frail).toBe(false);
    // The same roll with Int 3 as well fails.
    const low = frailSnag([3, 4]);
    low.h.character = {
      ...low.h.character,
      attributes: { base: { ...base, int: 3 }, people: {}, background: {}, advancement: {} },
    };
    purgeFrailty(low.w, data, low.h.id, low.snag.id);
    expect(low.snag.frail).toBe(true);
    // One short of 10 with Int 18 fails too: 3 + 3 + 1 + 2 is 9.
    const near = frailSnag([3, 3]);
    near.h.character = {
      ...near.h.character,
      attributes: { base, people: {}, background: {}, advancement: {} },
    };
    purgeFrailty(near.w, data, near.h.id, near.snag.id);
    expect(near.snag.frail).toBe(true);
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

describe('saves from before Purge Ailment’s one try', () => {
  it('loads a version 32 save with no one tried', () => {
    const w = world();
    w.benched = [w.members.pop() as Member];
    const save = JSON.parse(serializeWorld(w));
    const strip = (list: Record<string, unknown>[]) =>
      list.map((m) =>
        Object.fromEntries(
          Object.entries(m).filter(([k]) => !['purgeTries', 'poisoned', 'disease'].includes(k)),
        ),
      );
    const v32 = {
      ...save,
      schemaVersion: 32,
      members: strip(save.members),
      benched: strip(save.benched),
    };
    const loaded = parseWorld(JSON.stringify(v32), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    const all = [...loaded.world.members, ...loaded.world.benched];
    expect(all.every((m) => m.purgeTries.length === 0)).toBe(true);
    expect(all.every((m) => !m.poisoned && m.disease === null)).toBe(true);
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
          tend: [{ id: snag.id, name: 'Snag', ailment: 'frailty', label: 'Frailty' }],
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
