import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { commandsFor, isLegal } from '../../../src/game/combat/commands.ts';
import { readScroll, scrollAt, scrollCommand } from '../../../src/game/combat/scrolls.ts';
import type { Battle, Combatant } from '../../../src/game/combat/types.ts';
import type { InventoryEntry } from '../../../src/game/character/items.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
import { standardBattle, who } from './helpers.ts';

const COFFIN = 'the-coruscating-coffin';
const scroll = (spell = COFFIN, location: InventoryEntry['location'] = 'readied') => ({
  id: 'scroll',
  quantity: 1,
  location,
  spell,
  casterLevel: 3,
});

function carry(c: Combatant, ...lines: InventoryEntry[]): number {
  const ch = c.character;
  if (!ch) throw new Error('no character');
  c.character = { ...ch, inventory: [...ch.inventory, ...lines] };
  return ch.inventory.length;
}

const withMagic = (c: Combatant, level: number | null) => {
  const skills = { ...c.skills };
  delete skills.magic;
  c.skills = level === null ? skills : { ...skills, magic: level };
};

/** Two thugs; the first faces go to the scroll's check and target, then a seeded roll. */
function battle(faces: number[] = []): Battle {
  const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
  b.rng = scriptedThen(faces, createRng('scrolls'));
  return b;
}

describe('reading scrolls (docs/rules-adaptation.md, Scrolls; SRD 4.9.1)', () => {
  it('casts the spell at the scribe’s level, with no slots, for anyone with enough Magic', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    withMagic(snag, 0);
    const at = carry(snag, scroll());
    const cmd = scrollCommand(b, snag);
    expect(cmd?.label).toBe('Read a scroll');
    expect(cmd?.choices[0]?.label).toBe(
      'Scroll of The Coruscating Coffin (caster level 3): Thug or Militia [1-1]',
    );
    const action = { kind: 'scroll' as const, item: at, target: 'foe-0-0' };
    expect(isLegal(b, snag, action)).toBe(true);
    act(b, snag, action);
    // The Coffin slays a foe of 1 hit die outright.
    expect(who(b, 'foe-0-0').status).toBe('dead');
    expect(snag.caster).toBeNull();
    expect(snag.character?.inventory[at]).toBeUndefined();
    expect(b.log?.join('\n')).toContain('Snag reads Scroll of The Coruscating Coffin');
  });

  it('leaves a caster’s own slots and magic as they were', () => {
    const b = battle();
    const fizz = who(b, 'Fizzwick');
    const own = fizz.caster;
    const left = own?.spellsLeft;
    const at = carry(fizz, scroll());
    readScroll(b, fizz, { kind: 'scroll', item: at, target: 'foe-0-1' });
    expect(fizz.caster).toBe(own);
    expect(fizz.caster?.spellsLeft).toBe(left);
    expect(who(b, 'foe-0-1').status).toBe('dead');
  });

  it('rolls for a reader with too little Magic: success casts as aimed', () => {
    const b = battle([6, 6]);
    const snag = who(b, 'Snag');
    withMagic(snag, null);
    const at = carry(snag, scroll());
    readScroll(b, snag, { kind: 'scroll', item: at, target: 'foe-0-1' });
    expect(who(b, 'foe-0-1').status).toBe('dead');
    expect(who(b, 'foe-0-0').status).not.toBe('dead');
  });

  it('fizzles on a miss by 1 or 2', () => {
    // Untrained (−1) plus the better of Int and Cha, against 9: find a roll just short.
    const probe = battle();
    const s = who(probe, 'Snag');
    const bonus = -1 + Math.max(s.modifiers.int, s.modifiers.cha);
    const dice = 9 - 1 - bonus;
    const b = battle([Math.ceil(dice / 2), Math.floor(dice / 2)]);
    const snag = who(b, 'Snag');
    withMagic(snag, null);
    const at = carry(snag, scroll());
    readScroll(b, snag, { kind: 'scroll', item: at, target: 'foe-0-0' });
    expect(b.log?.join('\n')).toContain('fizzles');
    expect(b.combatants.filter((c) => c.status === 'dead')).toEqual([]);
    expect(snag.character?.inventory[at]).toBeUndefined();
  });

  it('strikes a random one of its targets on a worse miss', () => {
    const b = battle([1, 1, 1]);
    const snag = who(b, 'Snag');
    withMagic(snag, null);
    const at = carry(snag, scroll());
    readScroll(b, snag, { kind: 'scroll', item: at, target: 'foe-0-0' });
    expect(b.log?.join('\n')).toContain('twists loose');
    // The second choice, the other thug, takes it.
    expect(who(b, 'foe-0-1').status).toBe('dead');
    expect(who(b, 'foe-0-0').status).not.toBe('dead');
  });

  it('reads only readied scrolls of castable spells, and only as offered', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    withMagic(snag, 2);
    const stowed = carry(snag, scroll(COFFIN, 'stowed'));
    const repose = carry(snag, scroll('prudentially-transient-abnegation-of-life'));
    const mapSpell = carry(snag, scroll('the-excellent-transpicuous-transformation'));
    const dagger = snag.character?.inventory.findIndex((e) => e.id === 'dagger') as number;
    expect(scrollAt(b, snag, stowed)).toBeNull();
    expect(scrollAt(b, snag, dagger)).toBeNull();
    expect(scrollAt(b, snag, mapSpell)).toBeNull();
    expect(scrollAt(b, snag, 99)).toBeNull();
    // A spell with no target has nowhere to go from a scroll.
    expect(scrollAt(b, snag, repose)).not.toBeNull();
    expect(scrollCommand(b, snag)).toBeNull();
    expect(commandsFor(b, snag).some((c) => c.key === 'scroll')).toBe(false);
    expect(scrollCommand(b, who(b, 'foe-0-0'))).toBeNull();
    const before = snag.character?.inventory;
    readScroll(b, snag, { kind: 'scroll', item: stowed, target: 'foe-0-0' });
    readScroll(b, snag, { kind: 'scroll', item: dagger, target: 'foe-0-0' });
    expect(snag.character?.inventory).toBe(before);
    // A line holding a spell that isn't a scroll is no scroll either.
    const fake = carry(snag, { id: 'dagger', quantity: 1, location: 'readied', spell: COFFIN });
    expect(scrollAt(b, snag, fake)).toBeNull();
    const good = carry(snag, scroll());
    readScroll(b, snag, { kind: 'scroll', item: good, target: 'Grukk' });
    expect(snag.character?.inventory[good]).toBeDefined();
  });

  it('aims row spells at a row', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    withMagic(snag, 1);
    const at = carry(snag, scroll('the-wind-of-the-final-repose'));
    const cmd = scrollCommand(b, snag);
    expect(cmd?.choices.map((c) => c.action)).toEqual([{ kind: 'scroll', item: at, row: 0 }]);
    act(b, snag, { kind: 'scroll', item: at, row: 0 });
    expect(who(b, 'foe-0-0').status).toBe('asleep');
  });
});
