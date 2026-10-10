import { describe, expect, it } from 'vitest';
import { endOfRound } from '../../../src/game/combat/round.ts';
import { standardBattle } from './helpers.ts';

describe('a fight that a returning combatant can still reach (Phase 18a)', () => {
  it('goes on while a howled companion is on its way, as it does for a banished foe', () => {
    const b = standardBattle([['thug-or-militia']]);
    const [snag, ...others] = b.combatants.filter((c) => c.side === 'party');
    if (!snag) throw new Error('party expected');
    for (const c of others) c.status = 'dead';
    // Due back after this round's end, so the companion is still away when the fight is checked.
    Object.assign(snag, { status: 'out', returnsRound: b.round + 3 });
    endOfRound(b);
    expect(b.outcome).toBeNull();
  });

  it('is lost once the party has no one left, howling or not', () => {
    const b = standardBattle([['thug-or-militia']]);
    for (const c of b.combatants.filter((x) => x.side === 'party')) c.status = 'dead';
    endOfRound(b);
    expect(b.outcome).toBe('enemy');
  });
});
