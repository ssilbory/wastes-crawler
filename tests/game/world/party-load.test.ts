import { describe, expect, it } from 'vitest';
import { hike } from '../../../src/game/world/activities.ts';
import { hire } from '../../../src/game/world/hire.ts';
import { memberSheet } from '../../../src/game/world/members.ts';
import { buyMount } from '../../../src/game/world/mounts.ts';
import {
  leaveComponent,
  leaveDie,
  memberLoad,
  partyLoad,
  pickUp,
  roomFor,
  stashWeight,
} from '../../../src/game/world/party-load.ts';
import { addLoot } from '../../../src/game/world/shop.ts';
import { winnings } from '../../../src/game/world/winnings.ts';
import type { Member, World } from '../../../src/game/world/types.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

const own = (m: Member) => memberSheet(data, m).equipment.load;
const room = (m: Member) => own(m).stowedLimit - own(m).stowed;
const margin = (m: Member) => Math.floor(memberSheet(data, m).scores.str / 2) - own(m).excess;
const total = (w: World, f: (m: Member) => number) => w.members.reduce((s, m) => s + f(m), 0);

describe('the party stash’s weight (docs/rules-adaptation.md, Party stash)', () => {
  it('weighs one Stowed item per loot die and half per component', () => {
    const w = world();
    expect(stashWeight(w, data)).toBe(0);
    w.loot = [
      { count: 2, sides: 6 },
      { count: 1, sides: 8 },
    ];
    w.components = { 'beast-hide': 2, ironwood: 1 };
    expect(stashWeight(w, data)).toBe(4.5);
    expect(partyLoad(w, data)).toMatchObject({ weight: 4.5, overflow: 0 });
  });

  it('fills porters and mounts first, then the PCs with the most room', () => {
    const w = world([4, 4, 4]);
    w.purse = 1000;
    hire(w, data, 'porter');
    buyMount(w, data, 'riding-goat');
    w.loot = [{ count: 12 + 15 + 1, sides: 6 }];
    const p = partyLoad(w, data);
    expect(p.shares['npc-0']).toBe(12);
    expect(p.shares['mount-0']).toBe(15);
    const roomiest = [...w.members].sort((a, b) => room(b) - room(a))[0] as Member;
    expect(p.shares[roomiest.id]).toBe(1);
    // Underground the mounts wait outside, so the PCs carry their part.
    w.dungeon = {} as World['dungeon'];
    expect(partyLoad(w, data).shares['mount-0']).toBeUndefined();
  });

  it('spills into Overloaded margins, then shows the rest on the strongest PC', () => {
    const w = world();
    const free = total(w, (m) => Math.max(0, room(m)));
    const spare = total(w, (m) => Math.max(0, margin(m)));
    w.loot = [{ count: free + spare + 3, sides: 4 }];
    const p = partyLoad(w, data);
    expect(p.overflow).toBe(3);
    const strongest = [...w.members].sort((a, b) => margin(b) - margin(a))[0] as Member;
    expect(memberLoad(w, data, strongest, p).state).toBe('too-heavy');
    for (const m of w.members.filter((x) => x !== strongest))
      expect(memberLoad(w, data, m, p).state).toBe(margin(m) > 0 ? 'overloaded' : 'ok');
    // The dead carry nothing.
    const snag = member(w, 'Snag');
    snag.dead = true;
    expect(partyLoad(w, data).shares[snag.id]).toBeUndefined();
  });

  it('adds a member’s share to their own Stowed load', () => {
    const w = world();
    const lirael = member(w, 'Lirael');
    w.loot = [{ count: 2, sides: 6 }];
    const share = partyLoad(w, data).shares[lirael.id] ?? 0;
    expect(memberLoad(w, data, lirael).stowed).toBe(own(lirael).stowed + share);
  });
});

describe('picking up loot (Party stash)', () => {
  /** A party with exactly `left` Stowed items of room past every margin. */
  function nearlyFull(left: number): World {
    const w = world();
    const free = total(w, (m) => Math.max(0, room(m))) + total(w, (m) => Math.max(0, margin(m)));
    w.loot = [{ count: free - left, sides: 4 }];
    return w;
  }

  it('keeps everything that fits', () => {
    const w = world();
    expect(pickUp(w, data, () => addLoot(w, [{ count: 2, sides: 6 }]))).toEqual([
      { count: 2, sides: 6 },
    ]);
    expect(w.loot).toEqual([{ count: 2, sides: 6 }]);
  });

  it('leaves the smallest gained dice behind first, then components', () => {
    const w = nearlyFull(2);
    const before = w.loot[0]?.count;
    // 3 dice and half an item of hide into 2 items of room: both d6s stay behind.
    const kept = pickUp(w, data, () => {
      addLoot(w, [
        { count: 1, sides: 12 },
        { count: 2, sides: 6 },
      ]);
      w.components = { 'beast-hide': 1 };
    });
    expect(kept).toEqual([{ count: 1, sides: 12 }]);
    expect(w.loot).toEqual([
      { count: before, sides: 4 },
      { count: 1, sides: 12 },
    ]);
    expect(w.components).toEqual({ 'beast-hide': 1 });
    expect(w.log.at(-1)).toContain('leaves behind a d6, a d6.');
    // With no dice gained, components are left instead.
    const v = nearlyFull(0);
    pickUp(v, data, () => {
      v.components = { 'beast-hide': 1, ironwood: 1 };
    });
    expect(v.components).toEqual({});
    expect(v.log.at(-1)).toContain('leaves behind beast hide, ironwood heart.');
  });

  it('leaves only what it gained, not weight it was already too heavy by', () => {
    const w = nearlyFull(-3);
    expect(partyLoad(w, data).overflow).toBe(3);
    expect(pickUp(w, data, () => addLoot(w, [{ count: 1, sides: 8 }]))).toEqual([]);
    expect(w.loot.find((d) => d.sides === 4)?.count).toBeGreaterThan(0);
    expect(w.loot.some((d) => d.sides === 8)).toBe(false);
  });

  it('leaves winnings it can’t carry after a fight, and pays shares only on what it keeps', () => {
    const w = nearlyFull(0);
    w.rng = scriptedRng(Array<number>(20).fill(100));
    const lines = w.log.length;
    winnings(w, data, [['thug-or-militia']]);
    expect(w.log.slice(lines).join(' ')).toContain('leaves behind');
    expect(w.log.slice(lines).join(' ')).not.toContain('of loot.');
  });

  it('tells whether one more component fits', () => {
    expect(roomFor(world(), data, 'beast-hide')).toBe(true);
    expect(roomFor(nearlyFull(0), data, 'beast-hide')).toBe(false);
  });
});

describe('leaving loot behind by hand', () => {
  it('drops one die or component at a time', () => {
    const w = world();
    w.loot = [{ count: 2, sides: 6 }];
    w.components = { ironwood: 1 };
    expect(leaveDie(w, 6)).toEqual({ ok: true });
    expect(w.loot).toEqual([{ count: 1, sides: 6 }]);
    expect(leaveDie(w, 6)).toEqual({ ok: true });
    expect(w.loot).toEqual([]);
    expect(leaveDie(w, 6)).toEqual({ ok: false, reason: 'No d6 to leave.' });
    expect(leaveComponent(w, data, 'ironwood')).toEqual({ ok: true });
    expect(w.components).toEqual({});
    expect(leaveComponent(w, data, 'ironwood')).toEqual({
      ok: false,
      reason: 'No ironwood heart to leave.',
    });
  });
});

describe('the stash on the march', () => {
  it('makes those it overloads save on entering a hex', () => {
    const march = (dice: number) => {
      const w = world();
      w.loot = dice > 0 ? [{ count: dice, sides: 4 }] : [];
      w.rng = { next: () => 0, int: (min: number) => min, state: () => [1, 1, 1, 1] } as never;
      w.destination = { col: 4, row: 8 };
      hike(w, data, null, false);
      return w.log.filter((l) => l.endsWith('staggers under the load.')).length;
    };
    const w = world();
    const free = total(w, (m) => Math.max(0, room(m)));
    expect(march(free)).toBe(0);
    expect(march(free + 1)).toBe(1);
  });
});
