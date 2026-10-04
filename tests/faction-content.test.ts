import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { factionReferenceErrors } from '../src/data/faction-check.ts';
import { loadSrd } from '../src/data/load.ts';
import { settingReferenceErrors } from '../src/data/setting-check.ts';
import type { ContentData, Faction } from '../src/data/schemas/index.ts';

const srd = loadSrd();
const content = loadContent();

const withFactions = (f: Partial<ContentData['factions']>): ContentData => ({
  ...content,
  factions: { ...content.factions, ...f },
});

describe('faction content (Phase 13)', () => {
  it('loads four factions on Dark Lands hexes', () => {
    expect(factionReferenceErrors(srd, content)).toEqual([]);
    expect(content.factions.factions.map((f) => f.id)).toEqual([
      'warhost',
      'settlements',
      'bastion',
      'loyalists',
    ]);
    expect(content.campaign.clock.faction).toBe('warhost');
  });

  it('reports bad locations and assets', () => {
    const [loc] = content.factions.locations;
    const [asset] = content.factions.assets;
    if (!loc || !asset) throw new Error('missing content');
    expect(
      factionReferenceErrors(
        srd,
        withFactions({
          locations: [
            ...content.factions.locations,
            loc,
            { ...loc, id: 'atlantis', region: 'the-sea' },
            { ...loc, id: 'edge', col: 99 },
          ],
          assets: [...content.factions.assets, asset, { asset: 'dragon-hoard' }],
        }),
      ),
    ).toEqual([
      'factions: duplicate location cinderhold',
      'factions/atlantis: unknown region the-sea',
      'factions/edge: off the map',
      'factions: duplicate asset thugs',
      'factions: unknown asset dragon-hoard',
    ]);
  });

  it('reports factions that break their ratings, places, and rivals', () => {
    const [warhost, settlements] = content.factions.factions as [Faction, Faction];
    const bad: Faction = {
      ...warhost,
      hq: 'nowhere',
      bases: [{ at: 'nowhere', hp: 2 }],
      assets: [
        { asset: 'infantry', at: 'grisks-hold' },
        { asset: 'infantry', at: 'grisks-hold' },
        { asset: 'infantry', at: 'grisks-hold' },
      ],
      force: 2,
      buys: ['knights', 'enchanted-elites', 'cavalry'],
      enemies: ['warhost', 'pirates'],
      raise: ['force', 'force', 'wealth'],
      names: { dragon: 'Dragon' },
    };
    expect(
      factionReferenceErrors(
        srd,
        withFactions({
          factions: [bad, settlements, { ...settlements, bases: [{ at: 'cinderhold', hp: 2 }] }],
        }),
      ),
    ).toEqual([
      'factions: duplicate faction',
      'factions/warhost: unknown location nowhere',
      'factions/warhost: unknown location nowhere',
      'factions/warhost: a second base at its HQ',
      'factions/warhost: asset knights is not on the list',
      'factions/warhost: enchanted-elites needs force 3',
      'factions/warhost: cavalry needs force 4',
      'factions/warhost: infantry needs force 3',
      'factions/warhost: more force assets than its rating',
      'factions/warhost: bad rival warhost',
      'factions/warhost: bad rival pirates',
      'factions/warhost: raise must list each attribute once',
      'factions/warhost: a name for unknown asset dragon',
      // The bastion is left out of this content.
      'factions/settlements: bad rival bastion',
      'factions/settlements: a second base at its HQ',
      'factions/settlements: bad rival bastion',
    ]);
    // Magic: the settlements have none.
    expect(
      factionReferenceErrors(
        srd,
        withFactions({ factions: [{ ...settlements, buys: ['witch-hunters'] }] }),
      ),
    ).toEqual([
      'factions/settlements: witch-hunters needs low magic',
      'factions/settlements: bad rival warhost',
      'factions/settlements: bad rival bastion',
    ]);
  });

  it('needs the clock faction to exist', () => {
    const broken = {
      ...content,
      campaign: { ...content.campaign, clock: { ...content.campaign.clock, faction: 'nobody' } },
    };
    expect(settingReferenceErrors(srd, broken)).toContain('campaign: unknown faction nobody');
  });
});
