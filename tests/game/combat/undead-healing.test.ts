import { describe, expect, it } from 'vitest';
import type { Character } from '../../../src/data/schemas/index.ts';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { onlySpellsHeal } from '../../../src/game/combat/healing-strain.ts';
import { potionTargets } from '../../../src/game/combat/potions.ts';
import { canUse, combatMagic } from '../../../src/game/combat/spells.ts';
import type { Battle, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, starter, who } from './helpers.ts';

// Sam's call (docs/rules-adaptation.md, Necromancer: NPC slots): only spells heal the undead.

/** Snag as a Priest of Death with Healing Touch and Far Healer, carrying a readied draught. */
function priest(): Character {
  const snag = starter('snag');
  const draught: InventoryEntry = { id: 'healing-draught', quantity: 1, location: 'readied' };
  return {
    ...snag,
    classes: { current: 'healer-partial-mage', levels: { 'healer-partial-mage': 1 } },
    skills: { ...snag.skills, heal: 1 },
    arts: ['healing-touch', 'far-healer'],
    spells: { known: [], prepared: [] },
    inventory: [...snag.inventory, draught],
  };
}

/** The priest between a hurt raised zombie and a hurt hireling. */
function battle(): Battle {
  const npc = (monster: string, name: string, column: number) => ({
    monster,
    name,
    row: 0,
    column,
    hp: 1,
    maxHp: 8,
    noncombatant: false,
  });
  return createBattle({
    data,
    rng: createRng('undead-healing'),
    party: [{ character: priest(), row: 0, column: 1 }],
    npcs: [
      { ...npc('raised-zombie', 'Zombie', 0), servant: true },
      npc('thug-or-militia', 'Hob', 2),
    ],
    enemies: [['thug-or-militia']],
    log: true,
  });
}

const draughtAt = (c: Combatant) =>
  (c.character?.inventory ?? []).findIndex((e) => e.id === 'healing-draught');

describe('healing the undead', () => {
  it('is out of reach of Healing Touch and potions, but not of the living', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    const zombie = who(b, 'Zombie');
    const hob = who(b, 'Hob');
    expect(zombie.tags.has('undead')).toBe(true);
    const touch = combatMagic(b, 'healing-touch');
    if (!touch) throw new Error('no touch');
    expect(canUse(b, snag, touch, false, zombie.id)).toBe(false);
    expect(canUse(b, snag, touch, false, hob.id)).toBe(true);
    const targets = potionTargets(b, snag, draughtAt(snag));
    expect(targets).toContain(hob);
    expect(targets).not.toContain(zombie);
  });

  it('is left to spells: only arts and potions are barred', () => {
    const b = battle();
    const zombie = who(b, 'Zombie');
    for (const kind of ['heal', 'touch-heal', 'companion-heal', 'potion'])
      expect(onlySpellsHeal(zombie, kind)).toBe(true);
    expect(onlySpellsHeal(zombie, 'conjunct')).toBe(false);
    expect(onlySpellsHeal(who(b, 'Hob'), 'heal')).toBe(false);
  });
});
