import { describe, expect, it } from 'vitest';
import { emit } from '../../../src/game/world/bus.ts';
import { hire } from '../../../src/game/world/hire.ts';
import { accrueShares, addNpc } from '../../../src/game/world/npcs.ts';
import {
  hireBlocked,
  payDeadShare,
  payShares,
  refuseDeadShare,
} from '../../../src/game/world/shares.ts';
import { addLoot } from '../../../src/game/world/shop.ts';
import { enterTown } from '../../../src/game/world/town.ts';
import type { Npc, World } from '../../../src/game/world/types.ts';
import { shareText } from '../../../src/game/world/wording.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, member, world } from './helpers.ts';

/** The starters in Rubblegate with a guard (a quarter share) and a sellsword (three quarters). */
function hired(): World {
  const w = world([5, 5]);
  w.purse = 100;
  hire(w, data, 'guard');
  hire(w, data, 'veteran-sellsword');
  return w;
}
const npc = (w: World, i: number) => w.npcs[i] as Npc;

describe('hireling shares (docs/rules-adaptation.md, Hirelings)', () => {
  it('charge a flat signing fee, through the spending threshold', () => {
    const w = hired();
    expect(w.purse).toBe(60);
    const poor = world([5]);
    poor.purse = 10;
    expect(hire(poor, data, 'guard')).toEqual({
      ok: false,
      reason: 'Signing on costs 20 crowns.',
    });
    expect(poor.npcs).toEqual([]);
  });

  it('take their share of loot dice at the dice’s average, by share of a PC’s share', () => {
    const w = hired();
    // 2d10 average 11; four PCs and 0.25 + 0.75 shares make 5 shares.
    accrueShares(w, data, [{ count: 2, sides: 10 }]);
    expect(npc(w, 0).owed).toBe(0.6);
    expect(npc(w, 1).owed).toBe(1.7);
    // The dead don't count among the PCs.
    member(w, 'Snag').dead = true;
    accrueShares(w, data, [{ count: 4, sides: 6 }]);
    expect(npc(w, 0).owed).toBe(1.5);
    // Nobody hired, nothing owed.
    const alone = world();
    accrueShares(alone, data, [{ count: 1, sides: 6 }]);
    expect(alone.npcs).toEqual([]);
  });

  it('are paid on reaching a town, from the purse', () => {
    const w = hired();
    npc(w, 0).owed = 3;
    npc(w, 1).owed = 7.5;
    w.purse = 20;
    enterTown(w, data, 'westhold');
    expect(w.purse).toBe(9.5);
    expect(w.npcs.map((n) => n.owed)).toEqual([0, 0]);
    expect(w.log.join('\n')).toContain('Brenna takes their share: 7.5 crowns.');
  });

  it('cash in the loot when the purse is short, and a hireling still unpaid leaves', () => {
    const w = hired();
    npc(w, 0).owed = 10;
    npc(w, 1).owed = 40;
    w.purse = 5;
    addLoot(w, [{ count: 1, sides: 20 }]);
    w.rng = scriptedRng([12]);
    payShares(w, data);
    expect(w.loot).toEqual([]);
    expect(w.purse).toBe(0);
    expect(w.npcs.map((n) => n.name)).toEqual(['Aldo']);
    expect(w.log.at(-1)).toContain('Brenna is owed 40 crowns, takes the 7 there is, and leaves.');
  });

  it('leave a dead hireling’s share owed to their kin', () => {
    const w = hired();
    npc(w, 0).owed = 6;
    emit(w, data, { kind: 'npc-died', npc: npc(w, 0) });
    npc(w, 1).owed = 0;
    emit(w, data, { kind: 'npc-died', npc: npc(w, 1) });
    const captive = addNpc(w, data, 'captive', 'merchant', 'peaceful-human', 'M', false) as Npc;
    emit(w, data, { kind: 'npc-died', npc: { ...captive, owed: 3 } });
    expect(w.deadShares).toEqual([{ name: 'Aldo', owed: 6 }]);
    expect(hireBlocked(w, data)).toBe("First settle Aldo's share with their kin.");
    expect(hire(w, data, 'guard')).toMatchObject({ ok: false });
  });

  it('pay the kin, or refuse and find the town closed to hiring for a month', () => {
    const w = hired();
    w.deadShares = [
      { name: 'Aldo', owed: 6 },
      { name: 'Brenna', owed: 500 },
    ];
    w.purse = 10;
    expect(payDeadShare(w, data, 5)).toEqual({ ok: false, reason: 'No such share is owed.' });
    expect(payDeadShare(w, data, 1)).toEqual({
      ok: false,
      reason: 'The share is 500 crowns; cash in loot first.',
    });
    expect(payDeadShare(w, data, 0)).toEqual({ ok: true });
    expect(w.purse).toBe(4);
    expect(refuseDeadShare(w, data, 5)).toEqual({ ok: false, reason: 'No such share is owed.' });
    expect(refuseDeadShare(w, data, 0)).toEqual({ ok: true });
    expect(w.deadShares).toEqual([]);
    expect(w.hireBans).toEqual({ westhold: 30 });
    expect(hireBlocked(w, data)).toBe(
      'No one in Rubblegate will sign on with the party until day 31.',
    );
    w.day = 30;
    expect(hireBlocked(w, data)).toBeNull();
  });

  it('name the shares', () => {
    expect([0.25, 0.5, 0.75, 1, 0.3].map(shareText)).toEqual([
      'a quarter share',
      'a half share',
      'a three-quarter share',
      'a full share',
      'a 0.3 share',
    ]);
  });
});
