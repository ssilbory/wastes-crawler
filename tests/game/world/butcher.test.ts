import { describe, expect, it } from 'vitest';
import { combatReferenceErrors } from '../../../src/data/combat-check.ts';
import { butcher, killDie } from '../../../src/game/world/butcher.ts';
import { applyBattle } from '../../../src/game/world/fight.ts';
import { data, world } from './helpers.ts';

describe('beasts give rations (Phase 17)', () => {
  it('make a die one size per 4 hit dice of beasts slain, as far as d12', () => {
    expect(killDie(data, ['small-pack-predator'])).toBe(4);
    // A 7-HD cave bear is two steps; the bandit adds nothing.
    expect(killDie(data, ['cave-bear', 'thug-or-militia'])).toBe(6);
    expect(killDie(data, ['small-pack-predator', 'small-pack-predator', 'herd-beast'])).toBe(8);
    expect(killDie(data, ['colossus-bear', 'colossus-bear'])).toBe(12);
    expect(killDie(data, ['thug-or-militia'])).toBe(0);
    expect(killDie(data, [])).toBe(0);
  });

  it('become the rations, or step them up one size when they are already as large', () => {
    const w = world();
    w.rations = 0;
    butcher(w, data, ['cave-bear']);
    expect(w.rations).toBe(6);
    expect(w.log.at(-1)).toMatch(/The party butchers the kill\. Rations: d6\.$/);
    // d6 again on d6 steps up one.
    butcher(w, data, ['cave-bear']);
    expect(w.rations).toBe(8);
    // A small kill on large rations still steps them up one.
    butcher(w, data, ['small-pack-predator']);
    expect(w.rations).toBe(10);
    w.rations = 12;
    butcher(w, data, ['small-pack-predator']);
    expect(w.rations).toBe(12);
    // No beasts, no change and no word of it.
    const lines = w.log.length;
    butcher(w, data, ['thug-or-militia']);
    expect(w.log).toHaveLength(lines);
  });

  it('feed the party after a won fight', () => {
    const w = world();
    w.rations = 4;
    const fight = {
      battle: { combatants: [] } as never,
      setup: null as never,
      memberIds: [],
      npcIds: [],
      enemies: [['elephantine-grazer']],
      captive: null,
      quest: null,
      garrison: null,
      patrol: null,
    };
    applyBattle(
      w,
      data,
      fight,
      { outcome: 'party', rounds: 1, deaths: 0, battle: null as never },
      null,
    );
    expect(w.rations).toBe(6);
  });

  it('are kept free of loot by the content check', () => {
    const content = {
      ...data.content,
      monsterCombat: data.content.monsterCombat.map((m) =>
        m.id === 'cave-bear' || m.id === 'mushroom-king'
          ? { ...m, loot: { count: 1, sides: 6 } }
          : m,
      ),
    };
    // Plants give crafting components instead, so each needs one to drop (Phase 18a).
    const bare = {
      ...data.content,
      components: data.content.components.filter((c) => c.id !== 'spore-essence'),
    };
    expect(combatReferenceErrors(data.srd, bare)).toContain(
      'monsterCombat/mushroom-sporeling: a plant needs a component to drop',
    );
    expect(combatReferenceErrors(data.srd, content)).toEqual([
      'monsterCombat/cave-bear: beasts give rations, not loot',
      'monsterCombat/mushroom-king: plants give components, not loot',
    ]);
  });
});
