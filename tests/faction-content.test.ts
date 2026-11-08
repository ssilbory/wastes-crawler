import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { factionReferenceErrors } from '../src/data/faction-check.ts';
import { loadSrd } from '../src/data/load.ts';
import { settingReferenceErrors } from '../src/data/setting-check.ts';
import type { ContentData, Faction } from '../src/data/schemas/index.ts';

const srd = loadSrd();
const content = loadContent();

/** The Wastes' factions, kept beside a test's own so the realm and warlords still find theirs. */
const wastes = content.factions.factions.filter((f) => f.realm === 'wastes');

const withFactions = (f: Partial<ContentData['factions']>): ContentData => ({
  ...content,
  factions: { ...content.factions, ...f },
});

describe('faction content (Phase 13)', () => {
  it('loads four campaign factions and the Wastes’ six', () => {
    expect(factionReferenceErrors(srd, content)).toEqual([]);
    const ids = (realm: string | undefined) =>
      content.factions.factions.filter((f) => f.realm === realm).map((f) => f.id);
    expect(ids(undefined)).toEqual(['warhost', 'settlements', 'bastion', 'loyalists']);
    expect(ids('wastes')).toEqual([
      'well-keepers',
      'scrap-riders',
      'salt-packs',
      'dune-horde',
      'the-count',
      'sun-host',
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
      patrols: [{ asset: 'dragon', enemies: [['wyrm']] }],
    };
    expect(
      factionReferenceErrors(
        srd,
        withFactions({
          factions: [
            bad,
            settlements,
            { ...settlements, bases: [{ at: 'cinderhold', hp: 2 }] },
            ...wastes,
          ],
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
      'factions/warhost: a patrol for unknown asset dragon',
      'factions/warhost: patrol of unknown monster wyrm',
      // The bastion is left out of this content.
      'factions/settlements: bad rival bastion',
      'factions/settlements: a second base at its HQ',
      'factions/settlements: bad rival bastion',
    ]);
    // Magic: the settlements have none.
    expect(
      factionReferenceErrors(
        srd,
        withFactions({ factions: [{ ...settlements, buys: ['witch-hunters'] }, ...wastes] }),
      ),
    ).toEqual([
      'factions/settlements: witch-hunters needs low magic',
      'factions/settlements: bad rival warhost',
      'factions/settlements: bad rival bastion',
    ]);
  });

  it("needs the sieges' ally and wall-breaking assets to exist", () => {
    const broken = {
      ...content,
      siegeRules: { ...content.siegeRules, ally: 'pirates', ignoreWalls: ['trebuchets'] },
    };
    expect(factionReferenceErrors(srd, broken)).toEqual([
      'siegeRules: unknown ally pirates',
      'siegeRules: unknown asset trebuchets',
    ]);
  });

  it('needs the clock faction to exist', () => {
    const broken = {
      ...content,
      campaign: { ...content.campaign, clock: { ...content.campaign.clock, faction: 'nobody' } },
    };
    expect(settingReferenceErrors(srd, broken)).toContain('campaign: unknown faction nobody');
  });

  it('keeps a realm’s factions on its maps, its ally among them, and each warlord’s at home', () => {
    const [keepers, riders, packs] = wastes as [Faction, Faction, Faction];
    const broken: ContentData = {
      ...withFactions({
        factions: [
          ...content.factions.factions.filter((f) => f.realm !== 'wastes'),
          {
            ...keepers,
            enemies: ['warhost', 'scrap-riders'],
            bases: [{ at: 'gutterwick', hp: 1 }],
          },
          { ...riders, realm: 'atlantis' },
          { ...packs, hq: 'scrap-kings-pumpworks' },
          ...wastes.slice(3),
        ],
      }),
      realms: content.realms.map((r) =>
        r.id === 'sealed-vale' ? { ...r, ally: 'warhost', heldShut: true } : r,
      ),
    };
    expect(factionReferenceErrors(srd, broken)).toEqual([
      'factions/well-keepers: rival warhost is in another world',
      'factions/well-keepers: rival scrap-riders is in another world',
      'factions/well-keepers: gutterwick is outside wastes',
      'factions/scrap-riders: unknown realm atlantis',
      'factions/scrap-riders: rival well-keepers is in another world',
      'realms/sealed-vale: ally warhost is not one of its factions',
      'warlords/baron-vesk: faction salt-packs is not headquartered on wastes-glass',
    ]);
    const unallied = {
      ...content,
      realms: content.realms.map((r) => (r.id === 'sealed-vale' ? { ...r, heldShut: true } : r)),
    };
    expect(factionReferenceErrors(srd, unallied)).toEqual([
      'realms/sealed-vale: shuts held settlements with no ally',
    ]);
    const [first, second, ...rest] = content.warlords.warlords;
    if (!first || !second) throw new Error('missing content');
    const unbound = Object.fromEntries(
      Object.entries(first).filter(([k]) => k !== 'faction'),
    ) as typeof first;
    const lords = {
      ...content,
      warlords: {
        ...content.warlords,
        warlords: [unbound, { ...second, faction: 'nobody' }, ...rest],
      },
    };
    expect(factionReferenceErrors(srd, lords)).toEqual([
      'warlords/baron-vesk: unknown faction nobody',
    ]);
  });
});
