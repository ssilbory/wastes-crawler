import { describe, expect, it } from 'vitest';
import { filterLog } from '../../src/render/log-view.ts';

const LOG = [
  'Day 1, Morning: The party wins after 3 rounds.',
  'Day 1, Morning: The party takes 2d6 of loot.',
  'Day 1, Afternoon: Snag dies.',
  'Day 2, Morning: Lost Lamb: done. Return to Rubblegate for the reward.',
  'Day 2, Evening: Grukk builds a fire from a night’s firewood.',
];

const lines = (r: { line: string }[]) => r.map((x) => x.line.replace(/^Day \d+, \w+: /, ''));

describe('filterLog', () => {
  it('keeps every line, newest first, keyed by place in the log', () => {
    const all = filterLog(LOG, 'all', '');
    expect(all.map((x) => x.key)).toEqual([4, 3, 2, 1, 0]);
  });

  it('sieves by the words fights, loot, quests, and deaths use', () => {
    expect(lines(filterLog(LOG, 'fights', ''))).toEqual(['The party wins after 3 rounds.']);
    expect(lines(filterLog(LOG, 'loot', ''))).toEqual(['The party takes 2d6 of loot.']);
    expect(lines(filterLog(LOG, 'quests', ''))).toEqual([
      'Lost Lamb: done. Return to Rubblegate for the reward.',
    ]);
    expect(lines(filterLog(LOG, 'deaths', ''))).toEqual(['Snag dies.']);
  });

  it('searches without regard to case, alongside a filter', () => {
    expect(lines(filterLog(LOG, 'all', '  GRUKK '))).toEqual([
      'Grukk builds a fire from a night’s firewood.',
    ]);
    expect(filterLog(LOG, 'deaths', 'grukk')).toEqual([]);
  });
});
