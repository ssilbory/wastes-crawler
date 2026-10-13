import { describe, expect, it } from 'vitest';
import { runRound } from '../../../src/game/combat/battle.ts';
import { advance, currentActor } from '../../../src/game/combat/round.ts';
import { standardBattle, who } from './helpers.ts';

describe('log sides (docs/presentation-plan.md, V3)', () => {
  it('records whose turn each log line came in, and none between turns', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia'], ['veteran-soldier']]);
    // Initiative is rolled before anyone's turn.
    expect(b.logSides).toEqual([null]);
    runRound(b);
    expect(b.logSides).toHaveLength(b.log?.length ?? -1);
    expect(b.logSides).toContain('party');
    expect(b.logSides).toContain('enemy');
    // The round ends on no one's turn.
    expect(b.acting).toBeNull();
  });

  it('gives a stunned combatant’s lost turn to its side', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    b.queue = [snag.id, ...b.queue.filter((id) => id !== snag.id)];
    snag.stunned = true;
    currentActor(b);
    expect(b.log?.at(-1)).toContain('stunned');
    expect(b.logSides?.at(-1)).toBe('party');
  });

  it('starts a commanded turn on its side, and ends a won fight on no one’s', () => {
    const b = standardBattle([['thug-or-militia']]);
    const actor = advance(b, (c) => c.kind === 'pc');
    expect(actor?.side).toBe('party');
    expect(b.acting).toBe('party');
    who(b, 'foe-0-0').status = 'dead';
    expect(advance(b, () => false)).toBeNull();
    expect(b.outcome).toBe('party');
    expect(b.acting).toBeNull();
  });

  it('keeps no sides without a log', () => {
    const b = standardBattle([['thug-or-militia']], undefined, false);
    runRound(b);
    expect(b.logSides).toBeNull();
  });
});
