import { describe, expect, it } from 'vitest';
import { partyAction } from '../../../src/game/combat/ai.ts';
import { createBattle, runBattle, runRound } from '../../../src/game/combat/battle.ts';
import { checkMorale } from '../../../src/game/combat/morale.ts';
import type { Battle, Controller } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { data, starter, who } from './helpers.ts';

const wait: Controller = () => ({ kind: 'wait' });

/** Snag and Grukk against Lirael in front and Fizzwick behind. */
function rivalry(seed = 'rivals'): Battle {
  return createBattle({
    data,
    rng: createRng(seed),
    party: [
      { character: starter('snag'), row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
    ],
    enemies: [],
    rivals: [
      { character: starter('lirael'), row: 0, column: 0 },
      { character: starter('fizzwick'), row: 1, column: 0 },
    ],
  });
}

describe('rival characters on the enemy side (docs/rules-adaptation.md, Arena rivals)', () => {
  it('stand in a formation of their own as player characters', () => {
    const b = rivalry();
    expect(b.layout).toEqual({ party: 'formation', enemy: 'formation' });
    const lirael = who(b, 'foe-pc-0');
    expect(lirael).toMatchObject({ name: 'Lirael', kind: 'pc', side: 'enemy', row: 0, column: 0 });
    expect(who(b, 'foe-pc-1')).toMatchObject({ name: 'Fizzwick', side: 'enemy', row: 1 });
  });

  it('never mix with monsters, and number at most eight', () => {
    const rival = { character: starter('snag'), row: 0, column: 0 };
    const setup = { data, rng: createRng('x'), party: [rival] };
    expect(() =>
      createBattle({ ...setup, enemies: [['thug-or-militia']], rivals: [rival] }),
    ).toThrow('a side is either characters or monsters');
    const many = Array.from({ length: 9 }, (_, i) => ({ ...rival, row: i % 2, column: i % 4 }));
    expect(() => createBattle({ ...setup, enemies: [], rivals: many })).toThrow(
      'at most eight rivals',
    );
  });

  it('fight to the end: their morale never breaks', () => {
    const b = rivalry();
    for (const c of b.combatants) if (c.side === 'enemy') c.hp = 1;
    for (let i = 0; i < 20; i++) checkMorale(b);
    expect(b.combatants.filter((c) => c.side === 'enemy' && c.status === 'active')).toHaveLength(2);
  });

  it('drop their downed out of the front row, as the party does', () => {
    const b = rivalry();
    const lirael = who(b, 'Lirael');
    lirael.status = 'dying';
    lirael.fellRound = 1;
    runRound(b, wait, wait);
    expect(lirael.row).toBe(1);
  });

  it('choose their own actions against the party, and the fight comes to an end', () => {
    const b = rivalry();
    const action = partyAction(b, who(b, 'Lirael'));
    if (action.kind === 'attack') expect(who(b, action.target).side).toBe('party');
    const result = runBattle(b);
    expect(['party', 'enemy']).toContain(result.outcome);
  });
});
