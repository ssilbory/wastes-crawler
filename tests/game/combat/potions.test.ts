import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { partyAction } from '../../../src/game/combat/ai.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import {
  drinkPotion,
  potionAction,
  potionAt,
  potionTargets,
} from '../../../src/game/combat/potions.ts';
import type { Battle, Combatant } from '../../../src/game/combat/types.ts';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, who } from './helpers.ts';

/** Gives the combatant these lines in place of their pack, keeping their weapons. */
function carry(c: Combatant, ...lines: InventoryEntry[]): number {
  const ch = c.character;
  if (!ch) throw new Error('no character');
  c.character = { ...ch, inventory: [...ch.inventory, ...lines] };
  return ch.inventory.length;
}

const readied = (id: string, quantity = 1): InventoryEntry => ({
  id,
  quantity,
  location: 'readied',
});

function battle(faces: number[] = []): Battle {
  const b = standardBattle([['thug-or-militia']]);
  if (faces.length > 0) b.rng = scriptedRng(faces);
  return b;
}

describe('potions in a fight (docs/rules-adaptation.md, Potions)', () => {
  it('drinks a readied healing draught: 2d6 HP and 1 System Strain', () => {
    const b = battle([3, 4]);
    const snag = who(b, 'Snag');
    const at = carry(snag, readied('healing-draught', 2));
    snag.hp = 1;
    const strain = snag.strain?.strain ?? 0;
    const cmd = commandsFor(b, snag).find((c) => c.key === 'potion');
    expect(cmd?.choices.map((c) => c.label)).toContain('Healing Draught');
    act(b, snag, { kind: 'potion', item: at, target: snag.id });
    expect(snag.hp).toBe(Math.min(snag.maxHp, 8));
    expect(snag.strain?.strain).toBe(strain + 1);
    expect(snag.character?.inventory[at]?.quantity).toBe(1);
    expect(b.log?.join('\n')).toContain('Snag drinks a Healing Draught.');
  });

  it('pours one into a Mortally Wounded ally in touch, reviving them', () => {
    const b = battle([6, 6]);
    const snag = who(b, 'Snag');
    const grukk = who(b, 'Grukk');
    const at = carry(snag, readied('healing-draught'));
    grukk.status = 'dying';
    grukk.hp = 0;
    expect(potionTargets(b, snag, at)).toContain(grukk);
    const cmd = commandsFor(b, snag).find((c) => c.key === 'potion');
    expect(cmd?.choices.map((c) => c.label)).toEqual(['Healing Draught to Grukk']);
    drinkPotion(b, snag, at, grukk.id);
    expect(grukk.status).toBe('active');
    expect(grukk.hp).toBe(Math.min(grukk.maxHp, 12));
    expect(snag.character?.inventory[at]).toBeUndefined();
    expect(b.log?.join('\n')).toContain('Snag gives Grukk a Healing Draught.');
  });

  it('reaches only allies in touch, and only the hurt who can bear the strain', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    const lirael = who(b, 'Lirael');
    const at = carry(snag, readied('healing-draught'));
    // Unhurt, nobody can take it.
    expect(potionTargets(b, snag, at)).toEqual([]);
    lirael.hp = 1;
    // Behind Snag, Lirael is out of his touch, though he is in hers.
    expect(potionTargets(b, snag, at)).toEqual([]);
    snag.hp = 1;
    if (snag.strain) snag.strain = { ...snag.strain, strain: snag.strain.max };
    expect(potionTargets(b, snag, at)).toEqual([]);
    const lAt = carry(lirael, readied('healing-draught'));
    expect(potionTargets(b, lirael, lAt)).toContain(lirael);
    snag.status = 'dead';
    expect(potionTargets(b, lirael, lAt)).not.toContain(snag);
  });

  it('offers nothing for stowed potions, other gear, or out-of-fight potions', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    snag.hp = 1;
    const stowed = carry(snag, { id: 'healing-draught', quantity: 1, location: 'stowed' });
    const tonic = carry(snag, readied('restorative-tonic'));
    expect(potionTargets(b, snag, stowed)).toEqual([]);
    expect(potionTargets(b, snag, tonic)).toEqual([]);
    expect(potionTargets(b, snag, 0)).toEqual([]);
    expect(potionAt(b, snag, 0)).toBeNull();
    expect(potionAt(b, snag, 99)).toBeNull();
    expect(commandsFor(b, snag).some((c) => c.key === 'potion')).toBe(false);
    const foe = who(b, 'foe-0-0');
    expect(potionTargets(b, foe, 0)).toEqual([]);
    expect(commandsFor(b, foe).some((c) => c.key === 'potion')).toBe(false);
    // An illegal drink changes nothing.
    const before = snag.character?.inventory;
    drinkPotion(b, snag, tonic, snag.id);
    drinkPotion(b, snag, stowed, who(b, 'Grukk').id);
    expect(snag.character?.inventory).toBe(before);
  });

  it('oils the drinker’s weapon: +1 to hit and damage for the rest of the fight, once', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    const at = carry(snag, readied('oil-of-edge', 2));
    expect(potionTargets(b, snag, at)).toEqual([snag]);
    act(b, snag, { kind: 'potion', item: at, target: snag.id });
    expect(snag.edge).toEqual({ hit: 1, damage: 1 });
    expect(b.log?.join('\n')).toContain('Snag oils their weapon with Oil of Edge.');
    expect(potionTargets(b, snag, at)).toEqual([]);
    // Nobody else's weapon takes it, and a combatant with no attacks can't use it.
    const grukk = who(b, 'Grukk');
    const gAt = carry(grukk, readied('oil-of-edge'));
    grukk.attacks = [];
    expect(potionTargets(b, grukk, gAt)).toEqual([]);
  });

  it('adds the oil to the attack roll and the damage', () => {
    const plain = battle([10, 3]);
    const oiled = battle([10, 3]);
    const hit = (b: Battle) => {
      const snag = who(b, 'Snag');
      const foe = who(b, 'foe-0-0');
      foe.hp = 100;
      foe.maxHp = 100;
      return { snag, foe };
    };
    const a = hit(plain);
    const o = hit(oiled);
    o.snag.edge = { hit: 1, damage: 1 };
    act(plain, a.snag, { kind: 'attack', attack: 0, target: a.foe.id });
    act(oiled, o.snag, { kind: 'attack', attack: 0, target: o.foe.id });
    expect(100 - o.foe.hp).toBe(100 - a.foe.hp + 1);
  });
});

describe('the AI’s potions (Sam’s call)', () => {
  it('pours one into the Mortally Wounded in touch first', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    const grukk = who(b, 'Grukk');
    const at = carry(snag, readied('healing-draught'));
    grukk.status = 'dying';
    grukk.hp = 0;
    expect(potionAction(b, snag, grukk, false)).toEqual({
      kind: 'potion',
      item: at,
      target: grukk.id,
    });
  });

  it('drinks at a third of its hit points or less, unless an ally’s magic can heal it', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    const at = carry(snag, readied('oil-of-edge'), readied('healing-draught'));
    snag.hp = Math.floor(snag.maxHp / 3) + 1;
    expect(potionAction(b, snag, undefined, false)).toBeNull();
    snag.hp = Math.floor(snag.maxHp / 3);
    expect(potionAction(b, snag, undefined, true)).toBeNull();
    expect(potionAction(b, snag, undefined, false)).toEqual({
      kind: 'potion',
      item: at + 1,
      target: snag.id,
    });
    expect(partyAction(b, snag)).toEqual({ kind: 'potion', item: at + 1, target: snag.id });
  });

  it('never drinks without a readied healing potion', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    carry(snag, { id: 'healing-draught', quantity: 1, location: 'stowed' });
    snag.hp = 1;
    expect(potionAction(b, snag, undefined, false)).toBeNull();
    expect(partyAction(b, snag).kind).not.toBe('potion');
    // Monsters carry nothing.
    expect(potionAction(b, who(b, 'foe-0-0'), undefined, false)).toBeNull();
    expect(data.content.alchemy.potions.length).toBeGreaterThan(0);
  });
});
