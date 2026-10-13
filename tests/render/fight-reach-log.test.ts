import { describe, expect, it } from 'vitest';
import { sideTitle, sideTitles } from '../../src/render/arena-view.ts';
import { logLines } from '../../src/render/fight-log.ts';
import { reachOf } from '../../src/render/fight-reach.ts';
import { standardBattle, who } from '../game/combat/helpers.ts';

describe('reach (docs/presentation-plan.md, V3)', () => {
  it('marks the foes a front-row fighter reaches in melee, and those only in range', () => {
    const b = standardBattle([['thug-or-militia'], ['veteran-soldier']]);
    // Snag's spear reaches the front row; thrown, it reaches the second row too.
    expect(reachOf(b, who(b, 'Snag'))).toEqual(
      new Map([
        ['foe-0-0', 'melee'],
        ['foe-1-0', 'ranged'],
      ]),
    );
  });

  it('marks only range for a rear-row archer, and nothing for someone who can’t attack', () => {
    const b = standardBattle([['thug-or-militia'], ['veteran-soldier']]);
    const lirael = who(b, 'Lirael');
    expect([...reachOf(b, lirael).values()]).toEqual(['ranged', 'ranged']);
    lirael.attacks = [];
    expect(reachOf(b, lirael).size).toBe(0);
  });
});

describe('log filters', () => {
  const lines = ['a', 'b', 'c', 'd', 'xp'];
  const sides = [null, 'party', 'enemy', 'party'] as const;

  it('lists every line, or one side’s turns, keeping each line’s place', () => {
    expect(logLines(lines, sides, 'all').map((l) => l.text)).toEqual(lines);
    expect(logLines(lines, sides, 'party')).toEqual([
      { text: 'b', index: 1 },
      { text: 'd', index: 3 },
    ]);
    expect(logLines(lines, sides, 'enemy')).toEqual([{ text: 'c', index: 2 }]);
    expect(logLines(lines, null, 'party')).toEqual([]);
  });

  it('names each side for its filter', () => {
    const b = standardBattle([['thug-or-militia']]);
    expect(sideTitle(b, 'party')).toBe('The party');
    expect(sideTitles(b)).toEqual({ party: 'The party', enemy: 'The enemy' });
  });
});
