import { describe, expect, it } from 'vitest';
import { step } from '../../../src/game/dungeon/explore.ts';
import type { GameData } from '../../../src/game/character/context.ts';
import { emit } from '../../../src/game/world/bus.ts';
import { enterRegion } from '../../../src/game/world/crossing.ts';
import { maybeEncounter, rollEnemies, startEncounter } from '../../../src/game/world/encounters.ts';
import {
  authorityFor,
  bluff,
  endOrder,
  gainAuthority,
  giveCountersign,
  learnCountersign,
  orderOf,
  pendingOrder,
  presentAuthority,
} from '../../../src/game/world/orders.ts';
import { turnInQuest } from '../../../src/game/world/quest-board.ts';
import type { World } from '../../../src/game/world/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { below, place } from '../dungeon/helpers.ts';
import { data, encounter, member, world } from './helpers.ts';

const GATE = { col: 18, row: 12 };

/** The party at the Ruinfield Gate, its garrison barring the way. */
function atGate(d: GameData = data): World {
  const w = world(undefined, d);
  enterRegion(w, 'dark-lands', GATE);
  emit(w, d, { kind: 'hex-entered' });
  return w;
}

const withOrders = (patch: Partial<GameData['content']['standingOrders'][number]>): GameData => ({
  ...data,
  content: {
    ...data.content,
    standingOrders: data.content.standingOrders.map((o) =>
      o.id === 'ruinfield-gate' ? { ...o, ...patch } : o,
    ),
  },
});

describe('standing orders (docs/rules-adaptation.md, Standing orders)', () => {
  it('knows its orders', () => {
    expect(orderOf(data, 'ruinfield-gate').countersign).toBe('The ash remembers');
    expect(() => orderOf(data, 'nothing')).toThrow('unknown standing order nothing');
  });

  it('springs a garrison at its post, seen from afar, until its order ends', () => {
    const w = atGate();
    expect(w.encounter).toMatchObject({
      enemies: [['bound-orc-guard', 'bound-orc-guard'], ['bound-orc-captain']],
      order: 'ruinfield-gate',
      hostile: true,
      spotted: true,
    });
    expect(w.encounter?.text).toContain('They demand the countersign.');
    expect(pendingOrder(w, data)?.id).toBe('ruinfield-gate');
    // Not twice, nor once the order has ended, nor elsewhere, nor underground.
    const pending = w.encounter;
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBe(pending);
    w.encounter = null;
    w.ordersEnded.push('ruinfield-gate');
    emit(w, data, { kind: 'hex-entered' });
    expect(w.encounter).toBeNull();
    const away = world();
    emit(away, data, { kind: 'hex-entered' });
    expect(away.encounter).toBeNull();
    const deep = atGate();
    deep.encounter = null;
    deep.dungeon = below().dungeon;
    emit(deep, data, { kind: 'hex-entered' });
    expect(deep.encounter).toBeNull();
  });

  it('stands a garrison down for its countersign, and one offers to sign on', () => {
    const w = world();
    expect(giveCountersign(w, data)).toEqual({
      ok: false,
      reason: 'No one here is asking for a countersign.',
    });
    w.encounter = encounter([['bound-orc-guard']], { order: 'ruinfield-gate' });
    expect(giveCountersign(w, data)).toEqual({
      ok: false,
      reason: "The party doesn't know the countersign.",
    });
    learnCountersign(w, data, 'ruinfield-gate');
    learnCountersign(w, data, 'ruinfield-gate');
    expect(w.countersigns).toEqual(['ruinfield-gate']);
    expect(w.log.filter((l) => l.includes('learns the countersign'))).toHaveLength(1);
    expect(giveCountersign(w, data)).toEqual({ ok: true });
    expect(w.ordersEnded).toEqual(['ruinfield-gate']);
    expect(w.encounter).toMatchObject({ hostile: false, nature: 'wary', offer: 'guard' });
    expect(w.log.at(-1)).toContain('One of them offers to sign on as a Guard.');
    expect(pendingOrder(w, data)).toBeNull();
    // An ended order stays ended.
    const lines = w.log.length;
    endOrder(w, data, 'ruinfield-gate');
    expect(w.log).toHaveLength(lines);
  });

  it('obeys a token that commands the order, or any order', () => {
    const w = world();
    w.encounter = encounter([['bound-goblin-sentry']], { order: 'ash-road-patrol' });
    expect(presentAuthority(w, data)).toEqual({
      ok: false,
      reason: 'The party carries nothing they would obey.',
    });
    gainAuthority(w, data, 'seal-of-command');
    gainAuthority(w, data, 'seal-of-command');
    expect(w.authority).toEqual(['seal-of-command']);
    expect(authorityFor(w, data, 'anything')?.id).toBe('seal-of-command');
    w.authority = ['lieutenants-token'];
    expect(authorityFor(w, data, 'anything')).toBeUndefined();
    expect(presentAuthority(w, data)).toEqual({ ok: true });
    expect(w.log.at(-2)).toContain("The party shows A Lieutenant's Token. The bound salute.");
    // No recruit for a patrol.
    expect(w.encounter).toMatchObject({ hostile: false, offer: null });
    expect(presentAuthority(w, data)).toEqual({
      ok: false,
      reason: 'No one here answers to authority.',
    });
  });

  it('lets one bluff past, Convince against the order, as the one parley', () => {
    const easy = withOrders({ bluff: 6 });
    const w = world([6, 6]);
    expect(bluff(w, easy, 'x')).toEqual({ ok: false, reason: 'No one here to bluff.' });
    w.encounter = encounter([['bound-orc-guard']], { order: 'ruinfield-gate' });
    expect(bluff(w, easy, 'nobody')).toEqual({
      ok: false,
      reason: 'Choose someone to do the talking.',
    });
    expect(bluff(w, easy, member(w, 'Lirael').id)).toEqual({ ok: true });
    expect(w.encounter).toMatchObject({ hostile: false, spotted: true, parleyed: true });
    // Only this group: the order holds.
    expect(w.ordersEnded).toEqual([]);
    expect(bluff(w, easy, member(w, 'Lirael').id)).toEqual({
      ok: false,
      reason: 'They have heard enough.',
    });
    const hard = withOrders({ bluff: 16 });
    const v = world([1, 1]);
    v.encounter = encounter([['bound-orc-guard']], { order: 'ruinfield-gate', spotted: true });
    expect(bluff(v, hard, member(v, 'Lirael').id)).toEqual({ ok: true });
    expect(v.encounter).toMatchObject({ hostile: true, spotted: false });
    expect(v.log.at(-1)).toContain('stumbles over the lie. The bound attack.');
  });

  it('ends an order fulfilled by a quest turned in, and pays countersigns and authority', () => {
    const d: GameData = {
      ...withOrders({ complete: 'watchtower' }),
    };
    d.content = {
      ...d.content,
      quests: d.content.quests.map((q) =>
        q.id === 'watchtower'
          ? { ...q, reward: { ...q.reward, authority: 'lieutenants-token' } }
          : q,
      ),
    };
    const w = world(undefined, d);
    w.quests['bandit-camp'] = { status: 'ready', step: 1, acceptedDay: 0 };
    expect(turnInQuest(w, d, 'bandit-camp')).toEqual({ ok: true });
    expect(w.countersigns).toEqual([]);
    expect(w.ordersEnded).toEqual([]);
    w.quests.watchtower = { status: 'ready', step: 2, acceptedDay: 0 };
    w.position = { col: 17, row: 4 };
    expect(turnInQuest(w, d, 'watchtower')).toEqual({ ok: true });
    expect(w.countersigns).toEqual(['ash-road-patrol']);
    expect(w.authority).toEqual(['lieutenants-token']);
    expect(w.ordersEnded).toEqual(['ruinfield-gate']);
  });

  it('teaches a countersign from a clue underground, once', () => {
    const w = place(below(), 'barrow-lower', 2, 7, 'e');
    step(w, data, 'forward');
    expect(w.countersigns).toEqual(['ruinfield-gate']);
    expect(w.log.at(-2)).toContain('A dead orc courier lies here');
    const lines = w.log.length;
    step(w, data, 'back');
    step(w, data, 'forward');
    expect(w.log).toHaveLength(lines);
  });
});

/** Content whose plains table holds only the given entry. */
const onlyEntry = (entry: GameData['content']['encounterTables'][number]['entries'][number]) => ({
  ...data,
  content: {
    ...data.content,
    encounterTables: data.content.encounterTables.map((t) =>
      t.id === 'plains' ? { ...t, entries: [entry] } : t,
    ),
  },
});

describe('patrols and rescuers on the encounter tables', () => {
  const patrol = onlyEntry({
    weight: 1,
    nature: 'hostile',
    groups: [{ monster: 'bound-goblin-sentry', count: 2, row: 0 }],
    order: 'ash-road-patrol',
  });

  it('rolls a patrol with its order, and plain groups without one', () => {
    const w = world();
    expect(rollEnemies(w, patrol, 'plains')).toEqual({
      rows: [['bound-goblin-sentry', 'bound-goblin-sentry']],
      nature: 'hostile',
      captive: null,
      order: 'ash-road-patrol',
    });
    expect(Object.keys(rollEnemies(w, data, 'plains'))).toEqual(['rows', 'nature', 'captive']);
    const paladins = onlyEntry({
      weight: 1,
      nature: 'wary',
      groups: [{ monster: 'paladin', count: 1, row: 0 }],
      rescuers: true,
    });
    expect(rollEnemies(w, paladins, 'plains')).toMatchObject({ rescuers: true });
  });

  it('meets a patrol under its order, and none once the order has ended', () => {
    const meet = (w: World) => {
      w.position = { col: 5, row: 9 };
      for (let i = 0; i < 40; i++) if (maybeEncounter(w, patrol, undefined, false)) return true;
      return false;
    };
    const w = world();
    expect(meet(w)).toBe(true);
    expect(w.encounter?.order).toBe('ash-road-patrol');
    const v = world();
    v.ordersEnded = ['ash-road-patrol'];
    expect(meet(v)).toBe(false);
  });

  it('sends paladins to "rescue" an elf or gnome, fighting whatever their mood', () => {
    const rolled = {
      rows: [['paladin']],
      nature: 'wary' as const,
      captive: null,
      rescuers: true as const,
    };
    const w = world();
    w.rng = createRng('rescue');
    startEncounter(w, data, rolled, undefined, null, '5,9');
    expect(w.encounter).toMatchObject({ nature: 'hostile', hostile: true });
    expect(w.encounter?.text).toContain('They have come to "rescue" Lirael.');
    const v = world();
    member(v, 'Lirael').dead = true;
    member(v, 'Fizzwick').dead = true;
    v.rng = scriptedRng([6, 6]);
    startEncounter(v, data, rolled, undefined, null, '5,9');
    expect(v.encounter).toMatchObject({ nature: 'wary', hostile: false });
    expect(v.encounter?.text).not.toContain('rescue');
  });
});
