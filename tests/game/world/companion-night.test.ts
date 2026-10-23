import { describe, expect, it } from 'vitest';
import { nightForCompanions } from '../../../src/game/world/companion-night.ts';
import {
  followMaster,
  syncCompanion,
  syncToughness,
  untoughened,
} from '../../../src/game/world/companion-sync.ts';
import {
  bindCompanion,
  companionHere,
  companionOf,
  releaseCompanion,
  sendAway,
} from '../../../src/game/world/companions.ts';
import type { Member, Npc } from '../../../src/game/world/types.ts';
import { data, world } from './helpers.ts';
import { ranger } from './helpers-ranger.ts';

/** Snag as a Ranger with the given arts and Bramble, a wild aurochs, at their side. */
function withBramble(arts: string[] = [], level = 3, chosen = false) {
  const w = world();
  const m = ranger(w, arts, level);
  bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble', chosen);
  w.encounter = null;
  return { w, m, n: companionHere(w, m.id) as Npc };
}

const down = (m: Member, max = m.character.hp.max) => {
  m.character = { ...m.character, hp: { max, current: 0 } };
};

describe('a companion through the night (1.5.4)', () => {
  it('stays at the side of a master who is with the party', () => {
    const { w, m, n } = withBramble();
    nightForCompanions(w, data, true);
    expect(companionHere(w, m.id)).toBe(n);
    expect(m.companion).toBeNull();
  });

  it('wanders off for good when its master is gone from the company', () => {
    const { w, m } = withBramble();
    w.members = w.members.filter((x) => x !== m);
    const before = w.log.length;
    nightForCompanions(w, data, true);
    expect(w.npcs.some((x) => x.kind === 'companion')).toBe(false);
    expect(w.log).toHaveLength(before);
  });

  it('heals a companion sent away by its hit dice, up to its maximum', () => {
    const { w, m, n } = withBramble();
    sendAway(w, m.id);
    Object.assign(n, { maxHp: 30, hp: 10, hitDice: 3 });
    nightForCompanions(w, data, true);
    expect(n.hp).toBe(13);
    // A companion that came without a hit dice count heals by its kind's: 2 for an aurochs.
    delete n.hitDice;
    n.hp = 29;
    nightForCompanions(w, data, true);
    expect(n.hp).toBe(30);
  });

  it('brings a fallen Chosen Friend back whole, to wait for a master out of the party', () => {
    const { w, m, n } = withBramble([], 3, true);
    sendAway(w, m.id);
    n.hp = 0;
    m.dead = true;
    nightForCompanions(w, data, true);
    expect(m.companion).toBe(n);
    expect(n.hp).toBe(n.maxHp);
    expect(w.log.at(-1)).toContain('With the dawn Bramble is whole again, waiting for Snag.');
  });
});

describe('Shared Vitality and Feral Toughness as things change (1.5.4)', () => {
  it('does nothing for a master without a companion', () => {
    const w = world();
    const m = ranger(w, ['shared-vitality', 'feral-toughness']);
    syncCompanion(w, data, m);
    syncToughness(w, data, m);
    expect(companionOf(w, m)).toBeNull();
    expect(m.character.hp).toEqual({ max: 20, current: 20 });
    const before = w.log.length;
    followMaster(w, m);
    expect(w.log).toHaveLength(before);
  });

  it('raises a fallen companion’s hit dice and maximum, but leaves it fallen', () => {
    const { w, m, n } = withBramble([], 5, true);
    sendAway(w, m.id);
    Object.assign(n, { hp: 0, hitDice: 2, maxHp: 9 });
    syncCompanion(w, data, m);
    expect(n.hitDice).toBe(5);
    expect(n.maxHp).toBeGreaterThanOrEqual(12);
    expect(n.hp).toBe(0);
  });

  it('keeps a fallen master at zero as Feral Toughness’s hit points come and go', () => {
    const { w, m } = withBramble(['feral-toughness']);
    down(m);
    expect(m.character.hp).toEqual({ max: 22, current: 0 });
    let during = m.character.hp;
    untoughened(w, data, m, () => {
      during = m.character.hp;
    });
    expect(during).toEqual({ max: 20, current: 0 });
    down(m);
    releaseCompanion(w, data, m.id);
    expect(m.character.hp).toEqual({ max: 20, current: 0 });
    expect(m.toughness).toBe(0);
  });
});

describe('a master leaving the party (Sam’s call)', () => {
  it('takes their companion along', () => {
    const { w, m, n } = withBramble();
    followMaster(w, m);
    expect(m.companion).toBe(n);
    expect(w.npcs).toHaveLength(0);
    expect(w.log.at(-1)).toContain('Bramble goes with Snag.');
  });
});
