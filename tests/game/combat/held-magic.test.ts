import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { commandsFor, isLegal } from '../../../src/game/combat/commands.ts';
import { heldMagicAt, heldMagicCommand, invokeHeld } from '../../../src/game/combat/held-magic.ts';
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
    const cmd = heldMagicCommand(b, snag);
    expect(cmd?.label).toBe('Scrolls and devices');
    expect(cmd?.choices[0]?.label).toBe(
      'Scroll of The Coruscating Coffin (caster level 3): Thug or Militia [1-1]',
    );
    const action = { kind: 'invoke' as const, item: at, spell: COFFIN, target: 'foe-0-0' };
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
    invokeHeld(b, fizz, { kind: 'invoke', item: at, spell: COFFIN, target: 'foe-0-1' });
    expect(fizz.caster).toBe(own);
    expect(fizz.caster?.spellsLeft).toBe(left);
    expect(who(b, 'foe-0-1').status).toBe('dead');
  });

  it('rolls for a reader with too little Magic: success casts as aimed', () => {
    const b = battle([6, 6]);
    const snag = who(b, 'Snag');
    withMagic(snag, null);
    const at = carry(snag, scroll());
    invokeHeld(b, snag, { kind: 'invoke', item: at, spell: COFFIN, target: 'foe-0-1' });
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
    invokeHeld(b, snag, { kind: 'invoke', item: at, spell: COFFIN, target: 'foe-0-0' });
    expect(b.log?.join('\n')).toContain('The spell fizzles.');
    expect(b.combatants.filter((c) => c.status === 'dead')).toEqual([]);
    expect(snag.character?.inventory[at]).toBeUndefined();
  });

  it('rolls a Broken reader at a disadvantage (docs/rules-adaptation.md, Broken)', () => {
    const probe = battle();
    const s = who(probe, 'Snag');
    const bonus = -1 + Math.max(s.modifiers.int, s.modifiers.cha);
    // Kept 6 and the low die: a miss by 1 against 9, where 6 + 6 would have cast it.
    const b = battle([6, 6, 2 - bonus]);
    const snag = who(b, 'Snag');
    snag.strain = { strain: 0, max: 10, broken: true };
    withMagic(snag, null);
    const at = carry(snag, scroll());
    invokeHeld(b, snag, { kind: 'invoke', item: at, spell: COFFIN, target: 'foe-0-0' });
    expect(b.log?.join('\n')).toContain('The spell fizzles.');
  });

  it('strikes a random one of its targets on a worse miss', () => {
    const b = battle([1, 1, 1]);
    const snag = who(b, 'Snag');
    withMagic(snag, null);
    const at = carry(snag, scroll());
    invokeHeld(b, snag, { kind: 'invoke', item: at, spell: COFFIN, target: 'foe-0-0' });
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
    expect(heldMagicAt(b, snag, stowed)).toBeNull();
    expect(heldMagicAt(b, snag, dagger)).toBeNull();
    expect(heldMagicAt(b, snag, mapSpell)).toBeNull();
    expect(heldMagicAt(b, snag, 99)).toBeNull();
    // A spell with no target has nowhere to go from a scroll.
    expect(heldMagicAt(b, snag, repose)).not.toBeNull();
    expect(heldMagicCommand(b, snag)).toBeNull();
    expect(commandsFor(b, snag).some((c) => c.key === 'invoke')).toBe(false);
    expect(heldMagicCommand(b, who(b, 'foe-0-0'))).toBeNull();
    const before = snag.character?.inventory;
    invokeHeld(b, snag, { kind: 'invoke', item: stowed, spell: COFFIN, target: 'foe-0-0' });
    invokeHeld(b, snag, { kind: 'invoke', item: dagger, spell: COFFIN, target: 'foe-0-0' });
    expect(snag.character?.inventory).toBe(before);
    // A line holding a spell that isn't a scroll is no scroll either.
    const fake = carry(snag, { id: 'dagger', quantity: 1, location: 'readied', spell: COFFIN });
    expect(heldMagicAt(b, snag, fake)).toBeNull();
    const good = carry(snag, scroll());
    invokeHeld(b, snag, { kind: 'invoke', item: good, spell: COFFIN, target: 'Grukk' });
    expect(snag.character?.inventory[good]).toBeDefined();
  });

  it('aims row spells at a row', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    withMagic(snag, 1);
    const at = carry(snag, scroll('the-wind-of-the-final-repose'));
    const cmd = heldMagicCommand(b, snag);
    const repose = 'the-wind-of-the-final-repose';
    expect(cmd?.choices.map((c) => c.action)).toEqual([
      { kind: 'invoke', item: at, spell: repose, row: 0 },
    ]);
    act(b, snag, { kind: 'invoke', item: at, spell: repose, row: 0 });
    expect(who(b, 'foe-0-0').status).toBe('asleep');
  });
});

const wand = (spells = [COFFIN], charges = 2, id = 'wand') => ({
  id,
  quantity: 1,
  location: 'readied' as const,
  spells,
  casterLevel: 3,
  charges,
});

describe('wands and staves (docs/rules-adaptation.md, Devices; SRD 4.9.4)', () => {
  it('spend a charge a use, and crumble with the last', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    withMagic(snag, 0);
    const at = carry(snag, wand());
    expect(heldMagicCommand(b, snag)?.choices[0]?.label).toBe(
      'Wand of The Coruscating Coffin (caster level 3, 2 charges): Thug or Militia [1-1]',
    );
    act(b, snag, { kind: 'invoke', item: at, spell: COFFIN, target: 'foe-0-0' });
    expect(who(b, 'foe-0-0').status).toBe('dead');
    const left = snag.character?.inventory.find((e) => e.id === 'wand');
    expect(left?.charges).toBe(1);
    const again = snag.character?.inventory.indexOf(left as InventoryEntry) as number;
    act(b, snag, { kind: 'invoke', item: again, spell: COFFIN, target: 'foe-0-1' });
    expect(who(b, 'foe-0-1').status).toBe('dead');
    expect(snag.character?.inventory.some((e) => e.id === 'wand')).toBe(false);
    expect(b.log?.join('\n')).toContain('Its last charge spent, it crumbles.');
  });

  it('answer a staff only to a caster, who picks among its spells', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    const staff = wand([COFFIN, 'the-wind-of-the-final-repose'], 5, 'arcane-staff');
    expect(heldMagicAt(b, snag, carry(snag, staff))).toBeNull();
    const fizz = who(b, 'Fizzwick');
    const at = carry(fizz, staff);
    const labels = heldMagicCommand(b, fizz)?.choices.map((c) => c.label) ?? [];
    expect(labels).toContain(
      'Staff of The Coruscating Coffin, The Wind of the Final Repose (caster level 3, 5 charges): The Wind of the Final Repose: Row 1',
    );
    act(b, fizz, {
      kind: 'invoke',
      item: at,
      spell: 'the-wind-of-the-final-repose',
      row: 0,
    });
    expect(who(b, 'foe-0-0').status).toBe('asleep');
    expect(fizz.character?.inventory.find((e) => e.id === 'arcane-staff')?.charges).toBe(4);
  });

  it('send a wild spell only among its own targets', () => {
    const b = battle([1, 1, 1]);
    const fizz = who(b, 'Fizzwick');
    withMagic(fizz, null);
    const at = carry(fizz, wand([COFFIN, 'the-wind-of-the-final-repose'], 5, 'arcane-staff'));
    invokeHeld(b, fizz, { kind: 'invoke', item: at, spell: COFFIN, target: 'foe-0-0' });
    expect(who(b, 'foe-0-1').status).toBe('dead');
  });

  it('ignore rods, plain gear, and stowed devices', () => {
    const b = battle();
    const snag = who(b, 'Snag');
    const rod = carry(snag, { id: 'rod-of-light', quantity: 1, location: 'readied' });
    const stowed = carry(snag, { ...wand(), location: 'stowed' });
    expect(heldMagicAt(b, snag, rod)).toBeNull();
    expect(heldMagicAt(b, snag, stowed)).toBeNull();
  });
});

describe('rods in a fight (Devices)', () => {
  it('a Rod of Mending stabilizes with no check', () => {
    // Faces that would fail any check: the rod needs none.
    const b = battle([1, 1]);
    const lirael = who(b, 'Lirael');
    const snag = who(b, 'Snag');
    carry(lirael, { id: 'rod-of-mending', quantity: 1, location: 'readied' });
    snag.status = 'dying';
    snag.hp = 0;
    act(b, lirael, { kind: 'stabilize', target: snag.id });
    expect(snag.status).toBe('stable');
  });

  it('a Rod of Warding gives +1 to saves against spells', () => {
    const blinded = (rod: boolean) => {
      const b = battle([]);
      const fizz = who(b, 'Fizzwick');
      const foe = who(b, 'foe-0-0');
      // The foe needs the roll it would just miss without the rod.
      b.rng = scriptedThen([foe.saves.mental - 1], createRng('ward'));
      foe.character = rod
        ? {
            ...(who(b, 'Snag').character as NonNullable<Combatant['character']>),
            inventory: [{ id: 'rod-of-warding', quantity: 1, location: 'readied' }],
          }
        : null;
      act(b, fizz, { kind: 'cast', magic: 'damnation-of-the-sense', target: foe.id });
      return foe.blindRounds;
    };
    expect(blinded(false)).toBe(Number.POSITIVE_INFINITY);
    expect(blinded(true)).toBe(1);
  });
});
