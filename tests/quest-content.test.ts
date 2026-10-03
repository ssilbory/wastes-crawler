import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { questReferenceErrors } from '../src/data/quest-check.ts';
import type { Quest } from '../src/data/schemas/index.ts';

const srd = loadSrd();
const content = loadContent();

describe('quest content', () => {
  it('loads clean givers and quests', () => {
    expect(questReferenceErrors(srd, content)).toEqual([]);
    expect(content.quests.map((q) => q.reward.xp)).toEqual([3, 2, 2, 3]);
  });

  it('reports unknown references, bad hexes, late escorts, and loops', () => {
    const [giver] = content.missionGivers;
    if (!giver) throw new Error('missing content');
    const base: Quest = {
      id: 'odd',
      name: 'Odd',
      giver: 'nobody',
      summary: 'x',
      prerequisites: { quests: ['ghost', 'loop-b'], minLevel: 1 },
      objectives: [
        { kind: 'scout', hex: { col: 99, row: 99 }, text: 'x' },
        { kind: 'slay', hex: { col: 6, row: 5 }, enemies: [['dragon']], text: 'x' },
        { kind: 'deliver', item: 'x', to: 'atlantis', text: 'x' },
        { kind: 'escort', name: 'x', monster: 'dragon', to: 'westhold', text: 'x' },
      ],
      reward: { crowns: 0, xp: 0, loot: [] },
    };
    const loopB: Quest = {
      ...base,
      id: 'loop-b',
      giver: giver.id,
      prerequisites: { quests: ['odd'], minLevel: 1 },
      objectives: [base.objectives[0] as Quest['objectives'][0]],
    };
    const broken = {
      ...content,
      missionGivers: [...content.missionGivers, { ...giver, id: 'lost', town: 'atlantis' }],
      quests: [base, loopB],
    };
    expect(questReferenceErrors(srd, broken)).toEqual([
      'missionGivers/lost: unknown town atlantis',
      'quests/odd: unknown giver nobody',
      'quests/odd: unknown prerequisite ghost',
      'quests/odd: step 1 is not on passable land',
      'quests/odd: step 2 is not on passable land',
      'quests/odd: unknown monster dragon',
      'quests/odd: step 3 goes to unknown town atlantis',
      'quests/odd: an escort must be the first step',
      'quests/odd: unknown monster dragon',
      'quests/odd: needs itself',
      'quests/loop-b: step 1 is not on passable land',
      'quests/loop-b: needs itself',
    ]);
  });
});
