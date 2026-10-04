import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { townReferenceErrors } from '../src/data/town-check.ts';

const content = loadContent();

describe('town content', () => {
  it('loads clean town rules', () => {
    expect(townReferenceErrors(content)).toEqual([]);
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
    expect(townReferenceErrors(broken)).toEqual([
      'townRules: the first XP tier must start at a 0 down rate',
      'townRules: XP tiers must run from the lowest down rate up',
    ]);
  });
});
