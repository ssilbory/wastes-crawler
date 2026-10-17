import { describe, expect, it } from 'vitest';
import {
  beastmasters,
  bindable,
  bindCompanion,
  bindProblem,
  callCompanion,
  companionHere,
  companionOf,
  releaseCompanion,
  renameCompanion,
  sendAway,
  swiftHealing,
} from '../../../src/game/world/companions.ts';
import { monsterOf } from '../../../src/game/world/npcs.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { data, encounter, member, world } from './helpers.ts';
import { ranger } from './helpers-ranger.ts';

const fail = (reason: string) => ({ ok: false, reason });

/** Snag as a Ranger with Bramble, a wild aurochs, bound and at their side. */
function withBramble(arts: string[] = []): { w: World; m: Member } {
  const w = world();
  const m = ranger(w, arts);
  bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble');
  w.encounter = null;
  return { w, m };
}

describe('who can bind, and where (1.5.4)', () => {
  it('counts living members with Bind Companion as Beastmasters', () => {
    const w = world();
    expect(beastmasters(w)).toEqual([]);
    const m = ranger(w);
    expect(beastmasters(w)).toEqual([m]);
    m.dead = true;
    expect(beastmasters(w)).toEqual([]);
  });

  it('finds no beasts during an encounter, in a dungeon, or on a coach', () => {
    const w = world();
    const m = ranger(w);
    w.encounter = encounter([['human-raider']]);
    expect(bindProblem(w, data, m)).toBe('Deal with the encounter first.');
    expect(bindable(w, data, m)).toEqual([]);
    w.encounter = null;
    w.dungeon = {} as World['dungeon'];
    expect(bindProblem(w, data, m)).toBe('Companions are found in the open wilds.');
    w.dungeon = null;
    w.coach = { route: 'west-road', to: 'eastmarch', path: [], checkedDay: null };
    expect(bindProblem(w, data, m)).toBe('Companions are found in the open wilds.');
  });

  it('finds no beasts in a hex without an encounter table', () => {
    const w = world();
    const m = ranger(w);
    const bare = { ...data, content: { ...data.content, encounterTables: [] } };
    expect(bindable(w, bare, m)).toEqual([]);
  });

  it('refuses a Beastmaster who is down, or a beast that isn’t here to bind', () => {
    const w = world();
    const m = ranger(w);
    m.character = { ...m.character, hp: { max: 20, current: 0 } };
    expect(bindCompanion(w, data, m.id, 'wild-aurochs', 'Bramble')).toEqual(
      fail('Snag is in no state to bind a companion.'),
    );
    m.character = { ...m.character, hp: { max: 20, current: 20 } };
    const bear = monsterOf(data, 'cave-bear').name;
    expect(bindCompanion(w, data, m.id, 'cave-bear', 'Bruin')).toEqual(
      fail(`Snag can't find a ${bear} to bind here.`),
    );
    expect(companionOf(w, m)).toBeNull();
  });

  it('throws for a member who isn’t in the party', () => {
    expect(() => sendAway(world(), 'nobody')).toThrow('no member nobody');
  });
});

describe('orders outside a fight need a companion, and no encounter (Sam’s call)', () => {
  it('refuses to send away or heal a companion that isn’t with the party', () => {
    const w = world();
    const m = ranger(w, ['swift-healing']);
    expect(sendAway(w, m.id)).toEqual(fail("Snag's companion isn't with the party."));
    expect(swiftHealing(w, data, m.id)).toEqual(fail("Snag's companion isn't with the party."));
    expect(releaseCompanion(w, data, m.id)).toEqual(fail('Snag has no companion.'));
  });

  it('refuses to send away, call, or release during an encounter', () => {
    const { w, m } = withBramble();
    w.encounter = encounter([['human-raider']]);
    expect(sendAway(w, m.id)).toEqual(fail('Deal with the encounter first.'));
    expect(releaseCompanion(w, data, m.id)).toEqual(fail('Deal with the encounter first.'));
    w.encounter = null;
    sendAway(w, m.id);
    w.encounter = encounter([['human-raider']]);
    expect(callCompanion(w, data, m.id)).toEqual(fail('Deal with the encounter first.'));
    expect(m.companion?.name).toBe('Bramble');
  });

  it('can’t call from a master who is down', () => {
    const { w, m } = withBramble();
    sendAway(w, m.id);
    m.character = { ...m.character, hp: { max: 20, current: 0 } };
    expect(callCompanion(w, data, m.id)).toEqual(fail('Snag is in no state to call.'));
    expect(companionHere(w, m.id)).toBeUndefined();
  });

  it('releases a companion still with the party, freeing its slot', () => {
    const { w, m } = withBramble();
    expect(releaseCompanion(w, data, m.id)).toEqual({ ok: true });
    expect(w.npcs.some((n) => n.kind === 'companion')).toBe(false);
    expect(companionOf(w, m)).toBeNull();
    expect(w.log.at(-1)).toContain('Snag releases Bramble, who goes back to the wild.');
  });
});

describe('naming a companion anew (1.5.4)', () => {
  it('renames a companion with the party or sent away, but needs a name', () => {
    const { w, m } = withBramble();
    expect(renameCompanion(w, m.id, ' ')).toEqual(fail('Give the companion a name.'));
    expect(renameCompanion(w, m.id, '  Burr ')).toEqual({ ok: true });
    expect(companionHere(w, m.id)?.name).toBe('Burr');
    expect(w.log.at(-1)).toContain('Snag names Bramble Burr.');
    sendAway(w, m.id);
    expect(renameCompanion(w, m.id, 'Thistle')).toEqual({ ok: true });
    expect(m.companion?.name).toBe('Thistle');
  });

  it('has nothing to rename without a companion', () => {
    const w = world();
    expect(renameCompanion(w, member(w, 'Grukk').id, 'Burr')).toEqual(
      fail('Grukk has no companion.'),
    );
  });
});
