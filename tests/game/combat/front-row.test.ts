import { describe, expect, it } from 'vitest';
import { endOfRound } from '../../../src/game/combat/round.ts';
import type { Combatant } from '../../../src/game/combat/types.ts';
import { standardBattle } from './helpers.ts';

/** Two foes, the rest of the enemy side removed, placed as the test needs. */
function twoFoes(front: Partial<Combatant>, behind: Partial<Combatant>) {
  const b = standardBattle([['thug-or-militia', 'thug-or-militia']]);
  const foes = b.combatants.filter((c) => c.side === 'enemy');
  for (const f of foes.slice(2)) f.status = 'dead';
  const [a, c] = foes;
  if (!a || !c) throw new Error('two foes expected');
  Object.assign(a, { row: 0, column: 0, ...front });
  Object.assign(c, { row: 1, column: 0, ...behind });
  return { b, front: a, behind: c };
}

describe('monster rows stepping up (docs/rules-adaptation.md, combat rows)', () => {
  it('steps the second row up into a dead front slot', () => {
    const { b, behind } = twoFoes({ status: 'dead' }, { status: 'active' });
    endOfRound(b);
    expect(behind).toMatchObject({ row: 0, column: 0 });
  });

  it('does not step into a slot an out-of-action monster still holds', () => {
    const { b, front, behind } = twoFoes({ status: 'out' }, { status: 'active' });
    endOfRound(b);
    expect(front).toMatchObject({ row: 0, column: 0, status: 'out' });
    expect(behind.row).toBe(1);
  });
});
