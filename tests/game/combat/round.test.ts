import { describe, expect, it } from 'vitest';
import { createBattle } from '../../../src/game/combat/battle.ts';
import { advance } from '../../../src/game/combat/round.ts';
import { castMagic } from '../../../src/game/combat/spells.ts';
import type { Battle, CasterState } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { beastmaster } from '../beastmaster.ts';
import { data, who } from './helpers.ts';

/** A Ranger with the given arts and Bramble, a herd beast companion, against a raider. */
function battle(arts: string[]): Battle {
  const b = createBattle({
    data,
    rng: createRng('round'),
    party: [{ character: beastmaster(arts, 3), row: 0, column: 0, canBind: false }],
    npcs: [
      {
        monster: 'herd-beast',
        name: 'Bramble',
        row: 0,
        column: 1,
        hp: 9,
        maxHp: 9,
        noncombatant: false,
        servant: true,
        companion: { master: 0, chosen: false, shared: false, hitDice: 2 },
      },
    ],
    enemies: [['human-raider']],
  });
  // The raider lasts long enough for Bramble to take a turn.
  who(b, 'foe-0-0').hp = 99;
  return b;
}

describe('advance', () => {
  it('commits Mind Call’s Effort when a companion comes up for a command (1.5.4)', () => {
    const b = battle(['mind-call']);
    const caster = who(b, 'pc-0').caster as CasterState;
    const actor = advance(b, (c) => c.name === 'Bramble');
    expect(actor?.name).toBe('Bramble');
    expect(caster.usedThisScene.has('mind-call')).toBe(true);
    expect(caster.effortUsed).toBe(1);
  });

  it('commits nothing when a PC comes up for a command', () => {
    const b = battle(['mind-call']);
    const caster = who(b, 'pc-0').caster as CasterState;
    expect(advance(b, (c) => c.kind === 'pc')?.id).toBe('pc-0');
    expect(caster.effortUsed).toBe(0);
  });
});

describe('Swift Healing with no target (1.5.4)', () => {
  it('spends the art and heals no one', () => {
    const b = battle(['swift-healing']);
    const pc = who(b, 'pc-0');
    const bramble = who(b, 'Bramble');
    bramble.hp = 1;
    expect(castMagic(b, pc, 'swift-healing', undefined, undefined)).toBe(true);
    expect(bramble.hp).toBe(1);
    expect((pc.caster as CasterState).usedThisScene.has('swift-healing')).toBe(true);
  });
});
