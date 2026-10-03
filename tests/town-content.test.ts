import { describe, expect, it } from 'vitest';
import { loadContent } from '../src/data/content.ts';
import { loadSrd } from '../src/data/load.ts';
import { townReferenceErrors } from '../src/data/town-check.ts';
import { exportCharacter, importCharacter } from '../src/game/character/io.ts';

const srd = loadSrd();
const content = loadContent();

describe('town content', () => {
  it('loads clean town rules and a valid benchmark Warrior', () => {
    expect(townReferenceErrors(content)).toEqual([]);
    const w = content.benchmarkWarrior;
    expect(importCharacter(exportCharacter(w), { srd, content })).toEqual({
      ok: true,
      character: w,
    });
  });

  it('gives loot to people and automatons but not to beasts', () => {
    const loot = (id: string) => content.monsterCombat.find((m) => m.id === id)?.loot;
    expect(loot('thug-or-militia')).toEqual({ count: 1, sides: 6 });
    expect(loot('small-pack-predator')).toBeUndefined();
  });

  it('reports misordered tiers, a missing catch-all tier, and a non-Warrior benchmark', () => {
    const { xp } = content.townRules;
    const broken = {
      ...content,
      townRules: {
        ...content.townRules,
        xp: { ...xp, tiers: [...xp.tiers].reverse().slice(0, -1) },
      },
      benchmarkWarrior: {
        ...content.benchmarkWarrior,
        classes: { current: 'full-expert', levels: { 'full-expert': 1 } },
      },
    };
    expect(townReferenceErrors(broken)).toEqual([
      'townRules: XP tiers must run from the highest win rate down',
      'townRules: the last XP tier must start at a 0 win rate',
      'benchmarkWarrior: must be a Warrior',
    ]);
  });
});
