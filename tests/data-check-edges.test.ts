import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { combatReferenceErrors } from '../src/data/combat-check.ts';
import { craftingReferenceErrors } from '../src/data/crafting-check.ts';
import { loadSrd } from '../src/data/load.ts';
import { overlandReferenceErrors } from '../src/data/overland-check.ts';
import { questReferenceErrors } from '../src/data/quest-check.ts';
import { skillRuleErrors } from '../src/data/skills.ts';
import { travelReferenceErrors } from '../src/data/travel-check.ts';
import type { ContentData } from '../src/data/schemas/index.ts';

const srd = loadSrd();
const content = loadContent();
type Quest = ContentData['quests'][number];
const quest = (id: string) => content.quests.find((q) => q.id === id) as Quest;

describe('content checks catch what the shipped content never does', () => {
  it('a monster caster with an unknown spell tradition', () => {
    const monsterCombat = content.monsterCombat.map((m) =>
      m.caster ? { ...m, caster: { ...m.caster, spellTradition: 'atlantean' } } : m,
    );
    expect(combatReferenceErrors(srd, { ...content, monsterCombat })).toContain(
      'monsterCombat/petty-mage: unknown spell tradition atlantean',
    );
  });

  it('crafting tools that share an SRD item’s id', () => {
    const craftingRules = {
      ...content.craftingRules,
      tools: { ...content.craftingRules.tools, id: 'backpack' },
    };
    expect(craftingReferenceErrors(srd, { ...content, craftingRules })).toContain(
      "craftingRules: the tools' id backpack is an SRD item",
    );
  });

  it('a map generator with no land, no settlements, or an unknown terrain', () => {
    const lake = content.mapGen.biomes.filter((b) => b.terrain === 'lake');
    const mapGen = {
      ...content.mapGen,
      biomes: [...lake, { ...(lake[0] as (typeof lake)[0]), terrain: 'lava' }],
      sizes: { village: 0, town: 0, city: 0 },
    };
    expect(overlandReferenceErrors(srd, { ...content, mapGen })).toEqual(
      expect.arrayContaining([
        'mapGen: unknown terrain lava',
        'mapGen: no biome has land a settlement can stand on',
        'mapGen: no settlement size has any odds',
      ]),
    );
  });

  it('a quest paid by its own giver, or a raising paid by another', () => {
    const raising = content.quests.find((q) => q.reward.raise) as Quest;
    const quests = [
      { ...quest('letters'), payer: quest('letters').giver },
      { ...raising, payer: 'reeve-halda' },
    ];
    expect(questReferenceErrors(srd, { ...content, quests })).toEqual(
      expect.arrayContaining([
        'quests/letters: the giver already pays',
        `quests/${raising.id}: a raising quest is paid by its giver`,
      ]),
    );
  });

  it('a quest whose prerequisites meet again is no loop', () => {
    const base = quest('bandit-camp');
    const at = (id: string, quests: string[]) => ({
      ...base,
      id,
      prerequisites: { ...base.prerequisites, quests },
    });
    const quests = [
      at('root', []),
      at('left', ['root']),
      at('right', ['root']),
      at('top', ['left', 'right']),
    ];
    expect(
      questReferenceErrors(srd, { ...content, quests }).filter((e) => e.includes('loop')),
    ).toEqual([]);
  });

  it('a retired focus that the focus rules don’t know, or still offer', () => {
    const skillRules = {
      ...content.skillRules,
      retiredFoci: ['juggling', 'alert', 'special-origin'],
    };
    expect(skillRuleErrors(srd, { ...content, skillRules })).toEqual(
      expect.arrayContaining([
        'skillRules/retiredFoci/juggling: not an excluded focus',
        'skillRules/retiredFoci/alert: not an excluded focus',
      ]),
    );
    // A focus the game already leaves out may be retired.
    expect(skillRuleErrors(srd, { ...content, skillRules }).join()).not.toContain('special-origin');
  });

  it('late armor that is a shield', () => {
    const craftingRules = {
      ...content.craftingRules,
      drops: { ...content.craftingRules.drops, lateArmor: ['small-shield'] },
    };
    expect(craftingReferenceErrors(srd, { ...content, craftingRules })).toContain(
      "craftingRules: late armor small-shield isn't SRD body armor",
    );
  });

  it('a region with no terrain rows at all puts every town off the map', () => {
    const region = content.regions[0] as ContentData['regions'][number];
    const regions = [{ ...region, terrain: [], overlay: [] }];
    expect(overlandReferenceErrors(srd, { ...content, regions })).toEqual(
      expect.arrayContaining([
        'regions/borderlands/westhold: off the map',
        'regions/borderlands: the road at 23,8 is off the land',
      ]),
    );
  });

  it('a coach road between two regions', () => {
    const route = content.coachRoutes[0] as ContentData['coachRoutes'][number];
    const coachRoutes = [{ ...route, towns: ['westhold', 'cinderhold'] as [string, string] }];
    expect(travelReferenceErrors(srd, { ...content, coachRoutes })).toContain(
      `coachRoutes/${route.id}: joins towns in two regions`,
    );
  });
});
