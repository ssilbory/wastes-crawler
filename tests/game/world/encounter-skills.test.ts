import { describe, expect, it } from 'vitest';
import type { Monster } from '../../../src/data/schemas/index.ts';
import {
  acceptBeast,
  beastsOf,
  handlerRoom,
  handlers,
  nightForBeasts,
  offerBeast,
} from '../../../src/game/world/beasts.ts';
import { identify } from '../../../src/game/world/bestiary.ts';
import { meetGroup } from '../../../src/game/world/encounters.ts';
import { dismiss } from '../../../src/game/world/hire.ts';
import { canParley, parley } from '../../../src/game/world/parley.ts';
import { addNpc, fights, npcMonster } from '../../../src/game/world/npcs.ts';
import type { Member } from '../../../src/game/world/types.ts';
import { knownFoes, monsterStats } from '../../../src/render/bestiary-view.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, encounter, member, world } from './helpers.ts';

/** Gives a member these skills (and no others of the four tested) with Int, Wis, and Cha at 10. */
function plain(m: Member, skills: Record<string, number>): void {
  const a = m.character.attributes;
  const rest = Object.fromEntries(
    Object.entries(m.character.skills).filter(([id]) => id !== 'know' && id !== 'convince'),
  );
  m.character = {
    ...m.character,
    skills: { ...rest, ...skills },
    attributes: {
      base: { ...a.base, int: 10, wis: 10, cha: 10 },
      people: {},
      background: {},
      advancement: {},
    },
  };
}

/** A party where only Lirael knows monsters (Know-1, so a check adds 1). */
function scholarly() {
  const w = world();
  for (const m of w.members) plain(m, {});
  plain(member(w, 'Lirael'), { know: 1 });
  return w;
}

describe('Know (docs/rules-adaptation.md, Skills)', () => {
  it('names each new kind of monster once, against 6 plus 1 per 2 hit dice', () => {
    const none = world();
    for (const m of none.members) plain(m, {});
    none.rng = scriptedRng([]);
    expect(identify(none, data, [['herd-beast']])).toBe('');
    const w = scholarly();
    // Herd Beast: 2 HD, difficulty 7; 6 + 1 meets it. Thug: 1 HD, difficulty 6; 1 + 1 + 1 misses.
    w.rng = scriptedRng([3, 3, 1, 1]);
    expect(identify(w, data, [['herd-beast', 'herd-beast'], ['thug-or-militia']])).toBe(
      'Lirael knows the Herd Beast.',
    );
    expect(w.bestiary).toEqual(['herd-beast']);
    // Only the thug is rolled for again.
    w.rng = scriptedRng([6, 6, 6, 6]);
    expect(identify(w, data, [['herd-beast'], ['thug-or-militia', 'small-pack-predator']])).toBe(
      'Lirael knows the Thug or Militia and the Small Pack Predator.',
    );
    // The unconscious can't name anything.
    const lirael = member(w, 'Lirael');
    lirael.character = { ...lirael.character, hp: { ...lirael.character.hp, current: 0 } };
    w.rng = scriptedRng([]);
    expect(identify(w, data, [['large-solitary-predator']])).toBe('');
  });

  it('tells the party what it knows when it meets a group', () => {
    const w = scholarly();
    w.rng = scriptedRng([3, 4, 6, 6]);
    const e = meetGroup(w, data, [['herd-beast']], 'hostile', null, null, 'Beasts!');
    expect(e.text).toBe('Beasts! They size the party up. Lirael knows the Herd Beast.');
    expect(knownFoes(w, data, e.enemies)).toEqual([
      {
        id: 'herd-beast',
        name: 'Herd Beast',
        stats: 'HD 2, AC 11, attack +2 for 1d4, no Shock, move 40 ft, Morale 7, skill +1, save 14+',
      },
    ]);
    expect(knownFoes(w, data, [['thug-or-militia']])).toEqual([]);
  });

  it('writes out any stat line', () => {
    const base = data.srd.monsters.find((m) => m.id === 'thug-or-militia') as Monster;
    expect(monsterStats(base)).toBe(
      'HD 1, AC 13a, attack +1 for weapon +0, Shock weapon +0, move 30 ft, Morale 8, skill +1, save 15+',
    );
    const brute: Monster = {
      ...base,
      attacks: 2,
      damage: { kind: 'dice', dice: { count: 2, sides: 6, modifier: 2 } },
      shock: { kind: 'fixed', damage: 3, maxAc: null },
    };
    expect(monsterStats(brute)).toContain('attack +1 ×2 for 2d6+2, Shock 3/-');
    const weak: Monster = {
      ...brute,
      damage: { kind: 'dice', dice: { count: 1, sides: 4, modifier: -1 } },
      shock: { kind: 'fixed', damage: 1, maxAc: 13 },
    };
    expect(monsterStats(weak)).toContain('for 1d4-1, Shock 1/13');
  });
});

describe('Animal Ken (docs/rules-adaptation.md, Skills)', () => {
  it('opens parley with beasts and talks them round with Animal Ken', () => {
    const w = world();
    for (const m of w.members) plain(m, {});
    w.encounter = encounter([['herd-beast']], { reaction: 'friendly' });
    expect(canParley(w, data)).toBe(false);
    const snag = member(w, 'Snag');
    plain(snag, { 'animal-ken': 2 });
    expect(canParley(w, data)).toBe(true);
    // 4 + 4 + 2 meets 10 for a group that means to fight; Convince (untrained) would miss.
    w.rng = scriptedRng([4, 4]);
    expect(parley(w, data, 'talk', snag.id)).toEqual({ ok: true });
    expect(w.encounter).toMatchObject({ reaction: 'helpful', beast: 'herd-beast' });
    expect(w.log.at(-1)).toBe(
      'Day 1, morning: The Herd Beast looks ready to follow someone who knows beasts.',
    );
    // A mixed group is talked to with Convince.
    w.encounter = encounter([['herd-beast', 'thug-or-militia']]);
    w.rng = scriptedRng([4, 4]);
    parley(w, data, 'talk', snag.id);
    expect(w.encounter.reaction).toBe('unfriendly');
    // Out cold, Snag opens nothing.
    snag.character = { ...snag.character, hp: { ...snag.character.hp, current: 0 } };
    w.encounter = encounter([['herd-beast']]);
    expect(canParley(w, data)).toBe(false);
  });

  it('offers only an animal, the strongest of the group', () => {
    const w = world();
    const people = encounter([['thug-or-militia']]);
    offerBeast(w, data, people);
    expect(people.beast).toBeUndefined();
    const pack = encounter([['small-pack-predator', 'herd-beast', 'small-pack-predator']]);
    offerBeast(w, data, pack);
    expect(pack.beast).toBe('herd-beast');
  });

  it('wins a beast over for rations, Animal Ken + 1 to a handler', () => {
    const w = world();
    w.rations = 12;
    w.encounter = encounter([['herd-beast']], { beast: 'herd-beast' });
    const [snag, lirael] = [member(w, 'Snag'), member(w, 'Lirael')];
    expect(handlerRoom(w, data, snag)).toBe(0);
    expect(acceptBeast(w, data, snag.id)).toEqual({
      ok: false,
      reason: 'Choose someone with Animal Ken and room for another beast.',
    });
    plain(snag, { 'animal-ken': 0 });
    expect(handlers(w, data)).toEqual([snag]);
    w.rations = 4;
    expect(acceptBeast(w, data, snag.id)).toEqual({
      ok: false,
      reason: 'Winning the Herd Beast over takes 2 steps of the rations die.',
    });
    w.rations = 8;
    expect(acceptBeast(w, data, snag.id)).toEqual({ ok: true });
    expect(w.rations).toBe(4);
    expect(w.encounter.beast).toBeUndefined();
    expect(w.npcs[0]).toMatchObject({ kind: 'beast', type: 'herd-beast', name: 'Herd Beast' });
    expect(w.npcs[0]?.master).toBe(snag.id);
    expect(w.log.at(-1)).toContain(
      'The Herd Beast follows Snag now, won over with 2 steps of rations.',
    );
    expect(npcMonster(data, w.npcs[0] as never).id).toBe('herd-beast');
    expect(fights(data, w.npcs[0] as never)).toBe(true);
    expect(acceptBeast(w, data, snag.id)).toEqual({
      ok: false,
      reason: 'No beast has offered to follow.',
    });
    w.encounter.beast = 'herd-beast';
    expect(handlerRoom(w, data, snag)).toBe(0);
    plain(snag, { 'animal-ken': 1 });
    w.rations = 12;
    expect(acceptBeast(w, data, snag.id)).toEqual({ ok: true });
    expect(w.npcs[1]?.name).toBe('Herd Beast 2');
    expect(beastsOf(w, snag.id)).toHaveLength(2);
    plain(lirael, { 'animal-ken': 0 });
    w.encounter.beast = 'herd-beast';
    expect(acceptBeast(w, data, lirael.id)).toEqual({
      ok: false,
      reason: 'There is no room in the party.',
    });
    w.encounter = null;
    expect(acceptBeast(w, data, lirael.id).ok).toBe(false);
  });

  it('feeds beasts each night out of town, and loses them to hunger or a lost handler', () => {
    const w = world();
    const [snag, grukk] = [member(w, 'Snag'), member(w, 'Grukk')];
    const fed = addNpc(w, data, 'beast', 'herd-beast', 'herd-beast', 'Bess', true);
    const stray = addNpc(w, data, 'beast', 'herd-beast', 'herd-beast', 'Moo', true);
    Object.assign(fed ?? {}, { master: snag.id });
    Object.assign(stray ?? {}, { master: grukk.id });
    w.rng = scriptedRng([]);
    w.rations = 12;
    nightForBeasts(w, data, true);
    expect(w.npcs).toHaveLength(2);
    grukk.dead = true;
    w.rng = scriptedRng([5]);
    nightForBeasts(w, data, false);
    expect(w.npcs.map((n) => n.name)).toEqual(['Bess']);
    expect(w.log.join('\n')).toContain('With its handler gone, Moo wanders off.');
    expect(w.rations).toBe(12);
    w.rations = 0;
    nightForBeasts(w, data, false);
    expect(w.npcs).toEqual([]);
    expect(w.log.at(-1)).toContain(
      "With nothing to eat, Bess goes off to hunt and doesn't come back.",
    );
  });

  it('sets a beast loose', () => {
    const w = world();
    const beast = addNpc(w, data, 'beast', 'herd-beast', 'herd-beast', 'Bess', true);
    expect(dismiss(w, data, beast?.id ?? '')).toEqual({ ok: true });
    expect(w.log.at(-1)).toContain('Bess is set loose and lopes off into the wastes.');
  });
});
