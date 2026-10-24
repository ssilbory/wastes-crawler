import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { importCharacter } from '../../../src/game/character/io.ts';
import { partyAction } from '../../../src/game/combat/ai.ts';
import { createBattle, runBattle, runRound } from '../../../src/game/combat/battle.ts';
import { harm } from '../../../src/game/combat/damage.ts';
import { checkMorale } from '../../../src/game/combat/morale.ts';
import { beginRound } from '../../../src/game/combat/round.ts';
import type { Battle, CasterState, Controller } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedThen } from '../../helpers/scripted-rng.ts';
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

  it('stand one to a slot, in two rows of four', () => {
    const rival = { character: starter('snag'), row: 0, column: 0 };
    const setup = { data, rng: createRng('x'), party: [rival], enemies: [] };
    const slots = [[rival, rival], [{ ...rival, row: 2 }], [{ ...rival, column: 4 }]];
    for (const rivals of slots)
      expect(() => createBattle({ ...setup, rivals })).toThrow(
        'rivals stand one to a slot in two rows of four',
      );
  });

  it('roll initiative with their best Dex, as the party does', () => {
    // Both sides roll a 1: Grukk adds Dex +0, Lirael Dex +1, so the rivals go first.
    const b = createBattle({
      data,
      rng: scriptedThen([1, 1], createRng('x')),
      party: [{ character: starter('grukk'), row: 0, column: 0 }],
      enemies: [],
      rivals: [{ character: starter('lirael'), row: 0, column: 0 }],
    });
    expect(b.partyFirst).toBe(false);
  });

  it('fight to the end: half their side down, the rest still never break', () => {
    const b = rivalry();
    who(b, 'Lirael').status = 'dead';
    const fizzwick = who(b, 'Fizzwick');
    fizzwick.hp = 1;
    for (let i = 0; i < 20; i++) checkMorale(b);
    expect(fizzwick.status).toBe('active');
  });

  it('drop their downed out of the front row, as the party does', () => {
    const b = rivalry();
    const lirael = who(b, 'Lirael');
    lirael.status = 'dying';
    lirael.fellRound = 1;
    runRound(b, wait, wait);
    expect(lirael.row).toBe(1);
  });

  it('act first with Alert, as the party does', () => {
    const b = rivalry();
    who(b, 'Fizzwick').actsFirst = true;
    beginRound(b);
    expect(b.queue[0]).toBe('foe-pc-1');
    // With Alert on both sides, the side that won initiative goes first.
    who(b, 'Snag').actsFirst = true;
    for (const [partyFirst, lead] of [
      [false, 'foe-pc-1'],
      [true, 'pc-0'],
    ] as const) {
      b.partyFirst = partyFirst;
      beginRound(b);
      expect(b.queue.slice(0, 2)).toEqual(
        lead === 'pc-0' ? ['pc-0', 'foe-pc-1'] : ['foe-pc-1', 'pc-0'],
      );
    }
  });

  it('choose their own actions against the party', () => {
    const b = rivalry();
    const action = partyAction(b, who(b, 'Lirael'));
    expect(action.kind).toBe('attack');
    expect(action.kind === 'attack' && who(b, action.target).side).toBe('party');
  });

  it("don't raise the party's Invincible Citadel as they fall", () => {
    const b = createBattle({
      data,
      rng: createRng('citadel'),
      party: [{ character: starter('fizzwick'), row: 0, column: 0 }],
      enemies: [],
      rivals: [{ character: starter('grukk'), row: 0, column: 0 }],
    });
    const spells = ['invocation-of-the-invincible-citadel'];
    Object.assign(who(b, 'Fizzwick').caster as CasterState, {
      level: 9,
      known: spells,
      prepared: spells,
      spellsLeft: 9,
      canCast: true,
    });
    const grukk = who(b, 'Grukk');
    grukk.selfStabilize = false; // Without Die Hard, to fall as anyone does.
    harm(b, grukk, 99);
    expect([b.escaped, grukk.status]).toEqual([false, 'dying']);
  });

  it('fight the content parties to an end: the test party against the starter party', () => {
    const b = createBattle({
      data,
      rng: createRng('content-parties'),
      party: data.content.testParty,
      enemies: [],
      rivals: data.content.starterParty,
    });
    expect(b.combatants.filter((c) => c.side === 'enemy')).toHaveLength(6);
    expect(['party', 'enemy']).toContain(runBattle(b).outcome);
  });
});

describe('the test party (data/content/test-party.json)', () => {
  it('still imports, and matches the sample party the balance tools measure', () => {
    for (const { character } of data.content.testParty) {
      const file = `tools/sim/parties/starter/${character.name.toLowerCase()}.json`;
      const sample = importCharacter(readFileSync(file, 'utf8'), data);
      expect(importCharacter(JSON.stringify(character), data)).toEqual(sample);
    }
  });
});
