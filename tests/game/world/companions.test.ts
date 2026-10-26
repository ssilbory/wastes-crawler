import { describe, expect, it } from 'vitest';
import {
  bindable,
  bindCompanion,
  callCompanion,
  companionOf,
  releaseCompanion,
  sendAway,
  swiftHealing,
} from '../../../src/game/world/companions.ts';
import { immuneTo } from '../../../src/game/world/arts.ts';
import { sharedEyes, untoughened, companionHere } from '../../../src/game/world/companion-sync.ts';
import { endOfDay } from '../../../src/game/world/day.ts';
import { checkBonus } from '../../../src/game/world/members.ts';
import { parleyReach } from '../../../src/game/world/minds.ts';
import { dismiss } from '../../../src/game/world/hire.ts';
import { addNpc, MAX_NPCS } from '../../../src/game/world/npcs.ts';
import { regionMap } from '../../../src/game/world/region.ts';
import { parseWorld, serializeWorld } from '../../../src/game/world/save.ts';
import { bench } from '../../../src/game/world/tavern.ts';
import { data, member, world } from './helpers.ts';
import { ranger } from './helpers-ranger.ts';

const fail = (reason: string) => ({ ok: false, reason });

describe('Bind Companion (1.5.4)', () => {
  it('offers the hex’s animals of no more than the level plus one hit dice', () => {
    const w = world();
    const m = ranger(w, [], 1);
    expect(bindable(w, data, m)).toContain('wild-aurochs');
    expect(
      bindable(w, data, m).every((id) =>
        data.content.monsterCombat.some((c) => c.id === id && c.mind === 'animal'),
      ),
    ).toBe(true);
    w.position = regionMap(data, w.region).start;
    expect(bindable(w, data, m)).toEqual([]);
  });

  it('binds a named animal into an NPC slot for a quarter’s work', () => {
    const w = world();
    const m = ranger(w);
    const quarter = w.quarter;
    expect(bindCompanion(w, data, m.id, 'wild-aurochs', '  ')).toEqual(
      fail('Give the companion a name.'),
    );
    expect(bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble')).toEqual({ ok: true });
    const n = companionHere(w, m.id);
    expect(n).toMatchObject({ kind: 'companion', type: 'wild-aurochs', name: 'Bramble' });
    expect(n?.master).toBe(m.id);
    expect(w.quarter === quarter + 1 || w.encounter !== null).toBe(true);
    expect(w.log.some((l) => l.includes('binds a Wild Aurochs, Bramble.'))).toBe(true);
  });

  it('refuses a second companion, the art-less, and the town', () => {
    const w = world();
    const m = ranger(w);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    expect(bindCompanion(w, data, m.id, 'wild-aurochs', 'Burr')).toEqual(
      fail('Snag already has a companion; release it first.'),
    );
    const grukk = member(w, 'Grukk');
    expect(bindCompanion(w, data, grukk.id, 'wild-aurochs', 'Burr')).toEqual(
      fail('Grukk can’t bind a companion.'.replace('’', "'")),
    );
    const w2 = world();
    const m2 = ranger(w2);
    w2.position = regionMap(data, w2.region).start;
    expect(bindCompanion(w2, data, m2.id, 'wild-aurochs', 'Burr')).toEqual(
      fail('There are no wild beasts in town.'),
    );
  });

  it('needs a free NPC slot', () => {
    const w = world();
    const m = ranger(w);
    for (let i = 0; i < MAX_NPCS; i++)
      addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, true);
    expect(bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble')).toEqual(
      fail('There is no room in the party.'),
    );
  });
});

describe('sending a companion away and calling it (Sam’s call)', () => {
  it('frees the slot, and comes back for free while there is room', () => {
    const w = world();
    const m = ranger(w);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    expect(sendAway(w, m.id)).toEqual({ ok: true });
    expect(w.npcs).toHaveLength(0);
    expect(companionOf(w, m)?.name).toBe('Bramble');
    for (let i = 0; i < MAX_NPCS; i++)
      addNpc(w, data, 'hireling', 'guard', 'thug-or-militia', null, true);
    expect(callCompanion(w, data, m.id)).toEqual(fail('There is no room in the party.'));
    w.npcs = [];
    expect(callCompanion(w, data, m.id)).toEqual({ ok: true });
    expect(companionHere(w, m.id)?.name).toBe('Bramble');
    expect(m.companion).toBeNull();
    expect(callCompanion(w, data, m.id)).toEqual(fail('Snag has no companion waiting.'));
  });

  it('is what dismissing a companion from the NPC list does', () => {
    const w = world();
    const m = ranger(w);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    const n = companionHere(w, m.id);
    expect(dismiss(w, data, n?.id as string)).toEqual({ ok: true });
    expect(m.companion?.name).toBe('Bramble');
  });

  it('releases for good, but never a Chosen Friend', () => {
    const w = world();
    const m = ranger(w);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    sendAway(w, m.id);
    expect(releaseCompanion(w, data, m.id)).toEqual({ ok: true });
    expect(companionOf(w, m)).toBeNull();
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Old Friend', true);
    w.encounter = null;
    expect(releaseCompanion(w, data, m.id)).toEqual(
      fail('Old Friend is Snag’s chosen friend for life.'.replace('’', "'")),
    );
  });

  it('survives a save and load while sent away', () => {
    const w = world();
    const m = ranger(w);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    sendAway(w, m.id);
    const loaded = parseWorld(serializeWorld(w), data);
    if (!loaded.ok) throw new Error(loaded.errors.join('; '));
    expect(member(loaded.world, 'Snag').companion).toMatchObject({ name: 'Bramble' });
  });
});

describe('the companion arts outside a fight (1.5.4)', () => {
  it('raises a companion to the level in hit dice with Shared Vitality', () => {
    const w = world();
    const m = ranger(w, ['shared-vitality'], 5);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    const n = companionOf(w, m);
    expect(n?.hitDice).toBe(5);
    // Five rolled d8s, at least one apiece.
    expect(n?.maxHp).toBeGreaterThanOrEqual(5);
  });

  it('gives a Chosen Friend Shared Vitality without the art', () => {
    const w = world();
    const m = ranger(w, [], 4);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Old Friend', true);
    expect(companionOf(w, m)).toMatchObject({ hitDice: 4, chosen: true });
  });

  it('adds the companion’s natural hit dice to the maximum with Feral Toughness', () => {
    const w = world();
    const m = ranger(w, ['feral-toughness']);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    expect(m.character.hp).toEqual({ max: 22, current: 22 });
    expect(m.toughness).toBe(2);
    sendAway(w, m.id);
    expect(m.character.hp.max).toBe(22);
    releaseCompanion(w, data, m.id);
    expect(m.character.hp).toEqual({ max: 20, current: 20 });
    expect(m.toughness).toBe(0);
  });

  it('heals the companion with Swift Healing for Effort for the day', () => {
    const w = world();
    const m = ranger(w, ['swift-healing']);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    const n = companionHere(w, m.id);
    if (!n) throw new Error('no companion');
    expect(swiftHealing(w, data, m.id)).toEqual(fail("Bramble isn't hurt."));
    n.maxHp = 40;
    n.hp = 1;
    expect(swiftHealing(w, data, m.id)).toEqual({ ok: true });
    // 3d6 at level 3.
    expect(n.hp).toBeGreaterThanOrEqual(4);
    expect(m.effortDay).toBe(1);
    expect(swiftHealing(w, data, m.id)).toEqual(fail("Snag can't use Swift Healing now."));
  });
});

describe('a companion through the night (1.5.4)', () => {
  it('goes off to wait when its master is benched or dead', () => {
    const w = world();
    const m = ranger(w);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    m.dead = true;
    endOfDay(w, data);
    expect(w.npcs.some((n) => n.kind === 'companion')).toBe(false);
    expect(m.companion?.name).toBe('Bramble');
  });

  it('leaves the party with a master who stays at the tavern', () => {
    const w = world();
    const m = ranger(w);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    w.position = regionMap(data, w.region).start;
    expect(bench(w, data, m.id)).toEqual({ ok: true });
    expect(w.npcs).toHaveLength(0);
    expect(m.companion?.name).toBe('Bramble');
  });

  it('brings a fallen Chosen Friend back whole at dawn', () => {
    const w = world();
    const m = ranger(w);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Old Friend', true);
    w.encounter = null;
    const n = companionHere(w, m.id);
    if (!n) throw new Error('no companion');
    w.npcs = [];
    m.companion = { ...n, hp: 0 };
    expect(callCompanion(w, data, m.id)).toEqual(fail('Old Friend will return at dawn.'));
    endOfDay(w, data);
    expect(companionHere(w, m.id)?.hp).toBe(n.maxHp);
    expect(m.companion).toBeNull();
  });
});

describe('the Beastmaster’s senses and speech (1.5.4)', () => {
  it('opens parley with animals through Tongue of the Beasts while Effort is left', () => {
    const w = world();
    const m = ranger(w, ['tongue-of-the-beasts']);
    for (const x of w.members) x.character = { ...x.character, skills: { ...x.character.skills } };
    for (const x of w.members) delete x.character.skills['animal-ken'];
    expect(parleyReach(w, data).minds.has('animal')).toBe(true);
    m.effortDay = 1;
    expect(parleyReach(w, data).minds.has('animal')).toBe(false);
  });

  it('adds +2 to Notice with Savage Senses while Effort is left', () => {
    const w = world();
    const plain = checkBonus(data, ranger(w), 'notice', ['wis']);
    const m = ranger(w, ['savage-senses']);
    expect(checkBonus(data, m, 'notice', ['wis'])).toBe(plain + 2);
    m.effortDay = 1;
    expect(checkBonus(data, m, 'notice', ['wis'])).toBe(plain);
  });

  it('shares a companion’s eyes with Eyes of the Beast', () => {
    const w = world();
    const m = ranger(w, ['eyes-of-the-beast']);
    expect(sharedEyes(w, data)).toBeUndefined();
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    expect(sharedEyes(w, data)?.name).toBe('Bramble');
    m.effortDay = 1;
    expect(sharedEyes(w, data)).toBeUndefined();
  });

  it('keeps the cold off with Feral Toughness', () => {
    const w = world();
    expect(immuneTo(data, ranger(w), 'cold')).toBe(false);
    expect(immuneTo(data, ranger(w, ['feral-toughness']), 'cold')).toBe(true);
  });
});

describe('levelling a Beastmaster (1.5.4)', () => {
  it('levels without Feral Toughness’s hit points, and adds them back after', () => {
    const w = world();
    const m = ranger(w, ['feral-toughness', 'shared-vitality']);
    bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
    w.encounter = null;
    const seen: number[] = [];
    untoughened(w, data, m, () => seen.push(m.character.hp.max));
    expect(seen).toEqual([20]);
    expect(m.character.hp.max).toBe(22);
    expect(m.toughness).toBe(2);
  });
});
