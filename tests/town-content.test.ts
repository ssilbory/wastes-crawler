import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { townReferenceErrors } from '../src/data/town-check.ts';

const content = loadContent();
const srd = loadSrd();

describe('town content', () => {
  it('loads clean town rules', () => {
    expect(townReferenceErrors(srd, content)).toEqual([]);
  });

  it('gives loot to people and automatons but not to beasts', () => {
    const loot = (id: string) => content.monsterCombat.find((m) => m.id === id)?.loot;
    expect(loot('thug-or-militia')).toEqual({ count: 1, sides: 6 });
    expect(loot('small-pack-predator')).toBeUndefined();
  });

  it('reports misordered XP tiers and a first tier above a 0 down rate', () => {
    const { xp } = content.townRules;
    const broken = {
      ...content,
      townRules: { ...content.townRules, xp: { ...xp, tiers: [...xp.tiers].reverse() } },
    };
    expect(townReferenceErrors(srd, broken)).toEqual([
      'townRules: the first XP tier must start at a 0 down rate',
      'townRules: XP tiers must run from the lowest down rate up',
    ]);
  });

  it("reports shop staples and a realm's list that aren't shop gear", () => {
    const broken = {
      ...content,
      townRules: {
        ...content.townRules,
        shop: { ...content.townRules.shop, staples: ['torch', 'healing-draught'] },
      },
      realms: content.realms.map((r) => (r.id === 'wastes' ? { ...r, shop: ['nothing'] } : r)),
    };
    expect(townReferenceErrors(srd, broken)).toEqual([
      "townRules: the shop's staple healing-draught isn't shop gear",
      "realms/wastes: the shop's nothing isn't shop gear",
    ]);
  });
});
