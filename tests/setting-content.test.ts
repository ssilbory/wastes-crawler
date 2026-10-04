import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { settingReferenceErrors } from '../src/data/setting-check.ts';
import type { ContentData } from '../src/data/schemas/index.ts';

const srd = loadSrd();
const content = loadContent();

describe('setting content (Phase 12b)', () => {
  it('loads clean standing orders, authorities, garrisons, and raids', () => {
    expect(settingReferenceErrors(srd, content)).toEqual([]);
    expect(content.standingOrders.map((o) => o.id)).toEqual([
      'ruinfield-gate',
      'ash-road-patrol',
      'ashgate-hold',
      'bunker-watch',
      'vaels-war',
    ]);
    expect(content.raidRules.region).toBe('dark-lands');
  });

  it('reports what points nowhere', () => {
    const [order] = content.standingOrders;
    const [dungeon] = content.dungeons;
    const dark = content.regions.find((r) => r.id === 'dark-lands');
    const [table] = content.encounterTables;
    const [quest] = content.quests;
    if (!order || !dungeon || !dark || !table || !quest) throw new Error('missing content');
    const level = dungeon.levels[0] as (typeof dungeon.levels)[0];
    const broken: ContentData = {
      ...content,
      standingOrders: [{ ...order, complete: 'nothing', recruit: 'jester' }],
      authorities: [
        { id: 'a', name: 'A', text: 'A', commands: ['lost'] },
        { id: 'b', name: 'B', text: 'B', commands: 'all' },
      ],
      regions: [
        {
          ...dark,
          garrisons: [
            { order: 'lost', col: 99, row: 99, enemies: [['dragon']] },
            { order: 'ruinfield-gate', col: 6, row: 12, enemies: [['bound-orc-guard']] },
          ],
        },
      ],
      encounterTables: [
        { ...table, entries: [{ weight: 1, nature: 'hostile', groups: [], order: 'lost' }] },
      ],
      dungeons: [
        {
          ...dungeon,
          levels: [
            {
              ...level,
              specials: [
                { kind: 'countersign', at: { x: 0, y: 0 }, order: 'lost', text: 'x' },
                { kind: 'message', at: { x: 0, y: 0 }, text: 'x', people: ['human'] },
                { kind: 'notes', at: { x: 0, y: 0 }, set: 'lost', text: 'x' },
                { kind: 'token', at: { x: 0, y: 0 }, authority: 'lost', text: 'x' },
              ],
              garrisons: [
                { at: { x: 99, y: 0 }, order: 'lost', enemies: [['dragon']], text: 'x' },
                {
                  at: { x: 0, y: 0 },
                  order: 'ruinfield-gate',
                  enemies: [['thug-or-militia']],
                  text: 'x',
                },
              ],
            },
          ],
        },
      ],
      quests: [{ ...quest, reward: { ...quest.reward, countersigns: ['lost'], authority: 'z' } }],
      raidRules: {
        ...content.raidRules,
        region: 'atlantis',
        warningDays: 30,
        raiders: [['dragon']],
      },
    };
    // The campaign's own references are checked below.
    expect(settingReferenceErrors(srd, broken).filter((e) => !e.startsWith('campaign'))).toEqual([
      'standingOrders/ruinfield-gate: unknown quest nothing',
      'standingOrders/ruinfield-gate: unknown hireling type jester',
      'authorities/a: unknown order lost',
      'regions/dark-lands: the garrison at 99,99 has unknown order lost',
      'regions/dark-lands: the garrison at 99,99 is off the map',
      'regions/dark-lands: the garrison at 99,99: unknown monster dragon',
      'regions/dark-lands: the garrison at 6,12 is in a settlement',
      `encounterTables/${table.id}: unknown order lost`,
      `dungeons/${dungeon.id}/${level.id}: unknown order lost`,
      `dungeons/${dungeon.id}/${level.id}: message for unknown people human`,
      `dungeons/${dungeon.id}/${level.id}: unknown notes lost`,
      `dungeons/${dungeon.id}/${level.id}: unknown authority lost`,
      `dungeons/${dungeon.id}/${level.id}: the garrison at 99,0 has unknown order lost`,
      `dungeons/${dungeon.id}/${level.id}: the garrison at 99,0 is not on a plain floor cell`,
      `dungeons/${dungeon.id}/${level.id}: the garrison at 99,0: unknown monster dragon`,
      `quests/${quest.id}: unknown order lost`,
      `quests/${quest.id}: unknown authority z`,
      'raidRules: unknown region atlantis',
      'raidRules: the warning must come within the month',
      'raidRules: unknown monster dragon',
    ]);
    const campaign = content.campaign;
    const lostCampaign: ContentData = {
      ...content,
      campaign: {
        clock: { ...campaign.clock, segments: 1, knockback: { quests: ['q'], captives: ['c'] } },
        notes: { ...campaign.notes, giver: 'nobody' },
        seal: { ...campaign.seal, quest: 'q2', giver: 'nobody', authority: 'crown' },
      },
      quests: content.quests.map((q) =>
        q.id === 'warlord-falls'
          ? {
              ...q,
              objectives: q.objectives.map((o) =>
                o.kind === 'guardian' ? { ...o, reinforce: 'dragon' } : o,
              ),
            }
          : q,
      ),
    };
    const lost = settingReferenceErrors(srd, lostCampaign);
    expect(lost.filter((e) => e.startsWith('campaign'))).toEqual([
      'campaign: unknown quest q',
      'campaign: unknown quest q2',
      'campaign: unknown captive c',
      'campaign: unknown giver nobody',
      'campaign: unknown giver nobody',
      'campaign: unknown authority crown',
    ]);
    expect(lost).toContain('quests/warlord-falls: unknown monster dragon');
    expect(lost).toContain('encounterTables/dl-plains: a patrol needs more than 1 segments');
    const empty = { ...dark, sites: [] };
    expect(
      settingReferenceErrors(srd, { ...content, regions: [empty] }).filter((e) =>
        e.startsWith('raidRules'),
      ),
    ).toEqual(['raidRules: dark-lands has no settlements']);
  });
});
