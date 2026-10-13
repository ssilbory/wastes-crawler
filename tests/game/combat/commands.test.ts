import { describe, expect, it } from 'vitest';
import { commandsFor, describe as label, isLegal } from '../../../src/game/combat/commands.ts';
import { defaultAction, PRESET_NAMES } from '../../../src/game/combat/defaults.ts';
import type { Battle, CasterState } from '../../../src/game/combat/types.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, standardBattle, who } from './helpers.ts';

const keys = (b: Battle, name: string) => commandsFor(b, who(b, name)).map((c) => c.key);

describe('the command menu (SRD 2.4.3)', () => {
  it('lists attacks with their targets, Total Defense, moves, and Wait', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia'], ['veteran-soldier']]);
    const commands = commandsFor(b, who(b, 'Snag'));
    expect(commands.map((c) => c.key)).toEqual([
      'attack:0',
      'attack:1',
      'attack:2',
      'attack:3',
      'attack:4',
      'total-defense',
      'gear',
      'move',
      'wait',
    ]);
    expect(commands[0]).toMatchObject({ group: 'attack', label: 'Spear, Light' });
    // Thrown attacks reach the second row.
    expect(commands[1]).toMatchObject({ label: 'Spear, Light (thrown)' });
    expect(commands[1]?.choices).toHaveLength(3);
    expect(commands[0]?.choices.map((c) => c.label)).toEqual([
      'Thug or Militia [1-1]',
      'Thug or Militia [1-2]',
    ]);
    expect(commands[0]?.choices[0]?.action).toEqual({
      kind: 'attack',
      attack: 0,
      target: 'foe-0-0',
    });
    const move = commands.find((c) => c.key === 'move');
    expect(move?.label).toBe('Change slot');
    expect(move?.choices.map((c) => c.label)).toEqual([
      'Front row, slot 2: trade places with Grukk',
      'Front row, slot 3',
      'Front row, slot 4',
      'Rear row, slot 1: trade places with Lirael',
      'Rear row, slot 2: trade places with Fizzwick',
      'Rear row, slot 3',
      'Rear row, slot 4',
    ]);
    // A swap highlights the ally it trades with.
    expect(move?.choices[0]?.targetId).toBe('pc-1');
  });

  it('offers to stabilize dying allies not yet tended this round', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    snag.status = 'dying';
    const aid = commandsFor(b, who(b, 'Lirael')).find((c) => c.key === 'stabilize');
    expect(aid?.choices).toEqual([
      { label: 'Snag', targetId: snag.id, action: { kind: 'stabilize', target: snag.id } },
    ]);
    b.stabilizedThisRound.add(snag.id);
    expect(keys(b, 'Lirael')).not.toContain('stabilize');
  });

  it('lists castable magic by target, with strain casting once slots run out', () => {
    const b = standardBattle([['thug-or-militia'], ['veteran-soldier']]);
    const fizz = who(b, 'Fizzwick');
    const caster = fizz.caster as CasterState;
    const commands = commandsFor(b, fizz);
    const magic = commands.filter((c) => c.group === 'magic');
    expect(magic.map((c) => c.key)).toEqual([
      'magic:the-coruscating-coffin',
      'magic:the-wind-of-the-final-repose',
      'magic:damnation-of-the-sense',
      'magic:wardpact-invocation',
    ]);
    expect(magic[0]?.label).toBe('The Coruscating Coffin');
    expect(magic[1]?.choices.map((c) => [c.label, c.action])).toEqual([
      ['Row 1', { kind: 'cast', magic: 'the-wind-of-the-final-repose', row: 0 }],
      ['Row 2', { kind: 'cast', magic: 'the-wind-of-the-final-repose', row: 1 }],
    ]);
    // Wardpact isn't prepared, so it's a strain cast on anyone but the caster.
    expect(magic[3]?.choices.map((c) => c.label)).toEqual([
      'Snag (strain)',
      'Grukk (strain)',
      'Lirael (strain)',
    ]);
    expect(magic[3]?.choices[0]?.action).toEqual({
      kind: 'cast',
      magic: 'wardpact-invocation',
      target: 'pc-0',
      strain: true,
    });
    fizz.strain = { strain: fizz.strain?.max ?? 0, max: fizz.strain?.max ?? 0, broken: false };
    expect(keys(b, 'Fizzwick')).not.toContain('magic:wardpact-invocation');
    caster.canCast = false;
    expect(keys(b, 'Fizzwick').some((k) => k.startsWith('magic:'))).toBe(false);
  });

  it('lists arts by target, skipping passive ones, and ally spells including the caster', () => {
    const b = standardBattle([['automaton-laborer']]);
    const fizz = who(b, 'Fizzwick');
    const caster = fizz.caster as CasterState;
    caster.arts.push('pavis-of-elements', 'stunning-shock');
    const withAlly = {
      ...data,
      content: {
        ...data.content,
        combatMagic: data.content.combatMagic.map((m) =>
          m.id === 'wardpact-invocation' ? { ...m, target: 'ally' as const } : m,
        ),
      },
    };
    const commands = commandsFor({ ...b, data: withAlly }, fizz);
    const pavis = commands.find((c) => c.key === 'magic:pavis-of-elements');
    expect(pavis?.choices.map((c) => c.label)).toEqual(['Fizzwick']);
    expect(commands.find((c) => c.key === 'magic:stunning-shock')?.choices).toHaveLength(1);
    expect(commands.find((c) => c.key === 'magic:wardpact-invocation')?.choices).toHaveLength(4);
    expect(commands.some((c) => c.key === 'magic:empowered-sorcery')).toBe(false);
  });

  it('has no moves for monster rows, and labels monsters by slot', () => {
    const b = createBattle({
      data,
      rng: createRng('rows'),
      party: [],
      allies: [['thug-or-militia']],
      enemies: [['thug-or-militia']],
    });
    expect(keys(b, 'ally-0-0')).toEqual(['attack:0', 'total-defense', 'wait']);
    expect(label(who(b, 'foe-0-0'))).toBe('Thug or Militia [1-1]');
  });

  it('checks an action against the current choices', () => {
    const b = standardBattle([['thug-or-militia']]);
    const snag = who(b, 'Snag');
    expect(isLegal(b, snag, { kind: 'attack', attack: 0, target: 'foe-0-0' })).toBe(true);
    expect(isLegal(b, snag, { kind: 'attack', attack: 0, target: 'pc-1' })).toBe(false);
  });
});

describe('default actions', () => {
  it('names each preset', () => {
    expect(PRESET_NAMES.repeat).toBe('Repeat last command');
  });

  it('follows the preset, falling back to auto-combat when it can’t apply', () => {
    const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
    const snag = who(b, 'Snag');
    who(b, 'foe-0-0').hp = 9;
    who(b, 'foe-0-1').hp = 2;
    const weakest = { kind: 'attack', attack: 0, target: 'foe-0-1' };
    expect(defaultAction(b, snag, 'attack', null)).toEqual(weakest);
    expect(defaultAction(b, snag, 'auto', null)).toEqual(weakest);
    expect(defaultAction(b, snag, 'defend', null)).toEqual({ kind: 'total-defense' });
    const last = { kind: 'attack' as const, attack: 0, target: 'foe-0-0' };
    expect(defaultAction(b, snag, 'repeat', last)).toEqual(last);
    expect(defaultAction(b, snag, 'repeat', null)).toEqual(weakest);
    who(b, 'foe-0-0').status = 'dead';
    expect(defaultAction(b, snag, 'repeat', last)).toEqual(weakest);
    for (const e of b.combatants.filter((c) => c.side === 'enemy')) e.status = 'dead';
    expect(defaultAction(b, snag, 'attack', null)).toEqual({ kind: 'wait' });
  });
});
