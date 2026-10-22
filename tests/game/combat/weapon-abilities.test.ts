import { describe, expect, it } from 'vitest';
import { spellWard } from '../../../src/game/character/rods.ts';
import { pcCombatant } from '../../../src/game/combat/combatants.ts';
import { abilityDamage, drink } from '../../../src/game/combat/weapon-abilities.ts';
import type { Attack, Combatant } from '../../../src/game/combat/types.ts';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { act } from '../../../src/game/combat/actions.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

/** Snag with his dagger made magic, carrying the given ability. */
function armed(ability: string): Combatant {
  const c = starter('snag');
  const inventory = c.inventory.map((e): InventoryEntry =>
    e.id === 'dagger' ? { ...e, bonus: 1, ability } : e,
  );
  return pcCombatant(data, { ...c, inventory });
}
const dagger = (c: Combatant) => c.attacks.find((a) => a.id === 'dagger') as Attack;

describe('weapon abilities in a fight (docs/rules-adaptation.md, Abilities; SRD 4.9.3)', () => {
  it('ride on the attack made with the weapon, and only that one', () => {
    const snag = armed('flaming');
    expect(dagger(snag).magic).toEqual({
      kind: 'flaming',
      dice: { count: 1, sides: 4, modifier: 0 },
    });
    expect(snag.attacks.filter((a) => a.id !== 'dagger').every((a) => a.magic === null)).toBe(true);
    expect(pcCombatant(data, starter('snag')).attacks.every((a) => a.magic === null)).toBe(true);
  });

  it('Flaming adds its dice to every hit; a Bane only against its kind', () => {
    const b = standardBattle([['thug-or-militia', 'gnawing-dead', 'small-pack-predator']]);
    b.rng = scriptedRng([3, 4, 5]);
    const thug = who(b, 'foe-0-0');
    const dead = who(b, 'foe-0-1');
    const beast = who(b, 'foe-0-2');
    expect(abilityDamage(b, dagger(armed('flaming')), thug)).toBe(3);
    expect(abilityDamage(b, dagger(armed('bane-of-the-dead')), thug)).toBe(0);
    expect(abilityDamage(b, dagger(armed('bane-of-the-dead')), dead)).toBe(4);
    expect(abilityDamage(b, dagger(armed('bane-of-beasts')), beast)).toBe(5);
    expect(abilityDamage(b, dagger(armed('bane-of-beasts')), thug)).toBe(0);
    expect(abilityDamage(b, dagger(armed('bane-of-the-unliving')), beast)).toBe(0);
    expect(abilityDamage(b, dagger(armed('vampiric')), thug)).toBe(0);
    expect(abilityDamage(b, dagger(pcCombatant(data, starter('snag'))), thug)).toBe(0);
  });

  it('Vampiric gives a hit point back when the blow drops the foe', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const thug = who(b, 'foe-0-0');
    const fang = dagger(armed('vampiric'));
    snag.hp = 1;
    drink(b, snag, fang, thug);
    expect(snag.hp).toBe(1);
    thug.status = 'dead';
    drink(b, snag, fang, thug);
    expect(snag.hp).toBe(2);
    expect(b.log?.join('\n')).toContain('drinks, and Snag grows stronger');
    // A wielder already down takes nothing, and nor does a plain blade.
    snag.status = 'dying';
    drink(b, snag, fang, thug);
    snag.status = 'active';
    drink(b, snag, dagger(pcCombatant(data, starter('snag'))), thug);
    expect(snag.hp).toBe(2);
  });

  it('adds the ability’s damage to a real blow', () => {
    // The same seed on both sides: the flaming blow differs only by its flame, rolled last.
    const blow = (seed: string, flaming: boolean) => {
      const b = standardBattle([['veteran-soldier']], createRng(seed));
      const foe = who(b, 'foe-0-0');
      foe.hp = 100;
      foe.maxHp = 100;
      const snag = who(b, 'Snag');
      const flame = { kind: 'flaming' as const, dice: { count: 1, sides: 2, modifier: 10 } };
      if (flaming) snag.attacks = snag.attacks.map((x) => ({ ...x, magic: flame }));
      act(b, snag, { kind: 'attack', attack: 0, target: foe.id });
      return 100 - foe.hp;
    };
    const seed = ['a', 'b', 'c', 'd', 'e', 'f'].find((x) => blow(x, false) > 0) as string;
    const extra = blow(seed, true) - blow(seed, false);
    expect(extra).toBeGreaterThanOrEqual(11);
    expect(extra).toBeLessThanOrEqual(12);
  });
});

describe('Warding (Abilities; Devices)', () => {
  it('adds worn Warding armor and a Readied Rod of Warding to saves against spells', () => {
    const c = starter('grukk');
    const wear = (extra: InventoryEntry[]) => ({ ...c, inventory: [...c.inventory, ...extra] });
    expect(spellWard(data, c)).toBe(0);
    expect(spellWard(data, null)).toBe(0);
    const warded: InventoryEntry = {
      id: 'mail-shirt',
      quantity: 1,
      location: 'worn',
      bonus: 1,
      ability: 'warding',
    };
    expect(spellWard(data, wear([warded]))).toBe(2);
    expect(spellWard(data, wear([{ ...warded, location: 'stowed' }]))).toBe(0);
    const rod: InventoryEntry = { id: 'rod-of-warding', quantity: 1, location: 'readied' };
    expect(spellWard(data, wear([warded, rod]))).toBe(3);
  });
});
