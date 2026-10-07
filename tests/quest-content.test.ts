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
    expect(content.quests.map((q) => q.reward.xp)).toEqual([
      3, 2, 2, 3, 3, 0, 0, 0, 0, 0, 0, 3, 4, 2, 3, 4, 6, 4, 2, 0, 3, 4, 6,
    ]);
    expect(content.quests.filter((q) => q.reward.raise).map((q) => q.giver)).toEqual([
      'necromancer-ysolde',
      'necromancer-ysolde',
      'brother-aldo',
      'brother-aldo',
      'necromancer-vashti',
      'mother-skrell',
      'sister-orla',
    ]);
  });

  it('checks delve steps against the dungeons', () => {
    const quest = content.quests.find((q) => q.id === 'barrow-torc') as Quest;
    const odd: Quest = {
      ...quest,
      objectives: [
        { kind: 'reach', dungeon: 'old-barrow', level: 'cellar', text: 'x' },
        {
          kind: 'guardian',
          dungeon: 'old-barrow',
          level: 'barrow-lower',
          at: { x: 20, y: 0 },
          enemies: [['dragon']],
          text: 'x',
        },
        { kind: 'retrieve', dungeon: 'tomb', level: 'a', at: { x: 0, y: 0 }, item: 'x', text: 'x' },
      ],
    };
    expect(questReferenceErrors(srd, { ...content, quests: [odd] })).toEqual([
      'quests/barrow-torc: step 1 is in no dungeon level',
      'quests/barrow-torc: step 2 is off its level',
      'quests/barrow-torc: unknown monster dragon',
      'quests/barrow-torc: step 3 is in no dungeon level',
    ]);
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
        { kind: 'scout', region: 'borderlands', hex: { col: 99, row: 99 }, text: 'x' },
        {
          kind: 'slay',
          region: 'atlantis',
          hex: { col: 6, row: 5 },
          enemies: [['dragon']],
          text: 'x',
        },
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

  it('keeps raising to one crypt, mortuary, or temple per settlement, none in villages', () => {
    const raisers = content.missionGivers.filter((g) => g.raises);
    expect(raisers.map((g) => [g.id, g.raises])).toContainEqual(['mother-skrell', 'temple']);
    expect(raisers.map((g) => [g.id, g.raises])).toContainEqual(['brother-aldo', 'mortuary']);
    const ysolde = content.missionGivers.find((g) => g.raises === 'crypt');
    const raising = content.quests.find((q) => q.reward.raise);
    if (!ysolde || !raising) throw new Error('missing content');
    const broken = {
      ...content,
      missionGivers: [
        ...content.missionGivers,
        { ...ysolde, id: 'second', raises: 'mortuary' as const },
        { ...ysolde, id: 'hill', town: 'highcairn' },
        { ...ysolde, id: 'shrine', town: 'highcairn', raises: 'temple' as const },
      ],
      quests: [...content.quests, { ...raising, id: 'stray', giver: 'reeve-halda' }],
    };
    expect(questReferenceErrors(srd, broken)).toEqual([
      'missionGivers/second: westhold already raises the dead',
      'missionGivers/hill: a village has no crypt',
      'missionGivers/shrine: a village has no temple',
      'missionGivers/shrine: highcairn already raises the dead',
      "quests/stray: reeve-halda can't raise the dead",
    ]);
  });
});
