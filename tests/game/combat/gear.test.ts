import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import { readyOrStow } from '../../../src/game/combat/gear.ts';
import { carryBack } from '../../../src/game/world/fight.ts';
import { member, world } from '../world/helpers.ts';
import { data, standardBattle, who } from './helpers.ts';

describe('Ready or Stow an Item (SRD 2.4.0)', () => {
  it('stows a readied weapon and readies it again, its attack following', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const dagger = snag.character?.inventory.findIndex((e) => e.id === 'dagger') ?? -1;
    const before = snag.attacks.map((a) => a.name);
    expect(before).toContain('Dagger');
    const gear = commandsFor(b, snag).find((c) => c.key === 'gear');
    expect(gear?.choices.map((c) => c.label)).toContain('Stow Dagger');
    act(b, snag, { kind: 'gear', item: dagger, location: 'stowed' });
    expect(snag.attacks.map((a) => a.name)).not.toContain('Dagger');
    expect(b.log?.at(-1)).toContain('Snag stows Dagger.');
    const stowed = snag.character?.inventory.findIndex(
      (e) => e.id === 'dagger' && e.location === 'stowed',
    ) as number;
    expect(readyOrStow(b, snag, stowed, 'readied')).toBe(true);
    expect(snag.attacks.map((a) => a.name)).toContain('Dagger');
  });

  it('does nothing for worn gear, the wrong place, a missing line, or a monster', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const inv = snag.character?.inventory ?? [];
    const worn = inv.findIndex((e) => e.location === 'worn');
    const readied = inv.findIndex((e) => e.location === 'readied');
    expect(readyOrStow(b, snag, worn, 'stowed')).toBe(false);
    expect(readyOrStow(b, snag, readied, 'readied')).toBe(false);
    expect(readyOrStow(b, snag, 99, 'stowed')).toBe(false);
    expect(readyOrStow(b, who(b, 'foe-0-0'), 0, 'stowed')).toBe(false);
    expect(commandsFor(b, who(b, 'foe-0-0')).some((c) => c.key === 'gear')).toBe(false);
  });

  it('refuses to ready what would leave the PC too heavy to move', () => {
    const b = standardBattle([['thug-or-militia']]);
    const fizz = who(b, 'Fizzwick');
    const c = fizz.character;
    if (!c) throw new Error('no character');
    // Strength 3: one item readied, three stowed, and Overloaded up to one past them.
    fizz.character = {
      ...c,
      attributes: {
        ...c.attributes,
        base: { ...c.attributes.base, str: 3 },
        people: {},
        background: {},
        advancement: {},
      },
      inventory: [
        { id: 'dagger', quantity: 2, location: 'readied' },
        { id: 'dagger', quantity: 1, location: 'stowed' },
      ],
    };
    const before = fizz.character.inventory;
    expect(readyOrStow(b, fizz, 1, 'readied')).toBe(false);
    expect(fizz.character.inventory).toBe(before);
    expect(b.log?.at(-1)).toContain('Fizzwick has no room to ready that.');
  });

  it('keeps gear where it was put when the fight is over', () => {
    const w = world();
    const snag = member(w, 'Snag');
    const b = standardBattle([['thug-or-militia']]);
    const pc = who(b, 'Snag');
    const dagger = pc.character?.inventory.findIndex((e) => e.id === 'dagger') ?? -1;
    readyOrStow(b, pc, dagger, 'stowed');
    carryBack(data, snag, pc);
    expect(snag.character.inventory.find((e) => e.id === 'dagger')?.location).toBe('stowed');
    // A combatant without a character leaves the member's gear as it was.
    const kept = snag.character.inventory;
    carryBack(data, snag, { ...pc, character: null });
    expect(snag.character.inventory).toBe(kept);
  });

  it('names an item the content has lost by its id', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    const c = snag.character;
    if (!c) throw new Error('no character');
    snag.character = { ...c, inventory: [{ id: 'lost-thing', quantity: 1, location: 'stowed' }] };
    const gear = commandsFor(b, snag).find((x) => x.key === 'gear');
    expect(gear?.choices.map((x) => x.label)).toEqual(['Ready lost-thing']);
    readyOrStow(b, snag, 0, 'readied');
    expect(b.log?.at(-1)).toContain('Snag readies lost-thing.');
  });
});
