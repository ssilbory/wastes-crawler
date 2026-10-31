import { describe, expect, it } from 'vitest';
import { monsterAction } from '../../../src/game/combat/ai.ts';
import { createBattle } from '../../../src/game/combat/battle.ts';
import {
  endCharms,
  gaze,
  gazeAction,
  gazeTarget,
  raiseTheDead,
  throwOffCharms,
} from '../../../src/game/combat/charm.ts';
import { act } from '../../../src/game/combat/actions.ts';
import { fighters } from '../../../src/game/combat/morale.ts';
import { advance, endOfRound, takeTurn } from '../../../src/game/combat/round.ts';
import { targets } from '../../../src/game/combat/targeting.ts';
import type { Battle, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng, scriptedThen } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, starter, who } from './helpers.ts';

// docs/rules-adaptation.md, Charm and possession in Phase 19.
const party = (b: Battle) => b.combatants.filter((c) => c.side === 'party');
const vampire = (b: Battle) => who(b, 'Vampire');
const charmBy = (b: Battle, c: Combatant) => {
  c.charm = { by: vampire(b).id, side: 'enemy' };
};

describe("the vampire's gaze", () => {
  it('picks the standing foe with the most hit dice, then the most hit points', () => {
    const b = standardBattle([['vampire']]);
    const [snag, grukk, lirael, fizzwick] = party(b) as Combatant[];
    for (const c of [snag, grukk, lirael, fizzwick] as Combatant[]) c.hitDice = 1;
    (lirael as Combatant).hitDice = 2;
    (fizzwick as Combatant).hitDice = 2;
    (lirael as Combatant).hp = 3;
    (fizzwick as Combatant).hp = 5;
    expect(gazeTarget(b, vampire(b))).toBe(fizzwick);
    (fizzwick as Combatant).noncombatant = true;
    expect(gazeTarget(b, vampire(b))).toBe(lirael);
    (lirael as Combatant).tags = new Set(['unliving']);
    vampire(b).charmTried.push((snag as Combatant).id);
    expect(gazeTarget(b, vampire(b))).toBe(grukk);
    expect(gazeAction(b, vampire(b))).toEqual({ kind: 'gaze', target: (grukk as Combatant).id });
    // Not while someone is under its charm, and never for a creature with no gaze.
    charmBy(b, grukk as Combatant);
    expect(gazeTarget(b, vampire(b))).toBeNull();
    expect(gazeAction(b, vampire(b))).toBeNull();
    expect(gazeTarget(b, who(b, 'Snag'))).toBeNull();
  });

  it('turns a foe who fails a Mental save, and not one who makes it', () => {
    const b = standardBattle([['vampire']]);
    for (const c of party(b)) c.hitDice = 1;
    const snag = who(b, 'Snag');
    snag.hitDice = 3;
    b.rng = scriptedRng([20]);
    gaze(b, vampire(b), snag);
    expect(snag.charm).toBeNull();
    expect(vampire(b).charmTried).toEqual([snag.id]);
    // Tried once, never again: the next strongest is gazed at instead.
    const grukk = who(b, 'Grukk');
    grukk.hitDice = 2;
    gaze(b, vampire(b), snag);
    expect(vampire(b).charmTried).toEqual([snag.id]);
    b.rng = scriptedRng([1]);
    act(b, vampire(b), { kind: 'gaze', target: grukk.id });
    expect(grukk.charm).toEqual({ by: vampire(b).id, side: 'enemy' });
    expect(b.log?.join(' ')).toContain('turns on their own side');
    gaze(b, vampire(b), undefined);
  });

  it('is the vampire’s whole Main Action', () => {
    const b = standardBattle([['vampire']]);
    b.rng = scriptedThen([1], createRng('gaze'));
    takeTurn(b, vampire(b), monsterAction);
    expect(party(b).filter((c) => c.charm)).toHaveLength(1);
    expect(party(b).every((c) => c.hp === c.maxHp)).toBe(true);
  });
});

describe('the charmed', () => {
  it('strike at their own side, played by the engine, or wait with no one in reach', () => {
    const b = standardBattle([['vampire']]);
    const snag = who(b, 'Snag');
    charmBy(b, snag);
    const action = monsterAction(b, snag);
    expect(action).toMatchObject({ kind: 'attack' });
    expect(['pc-1', 'pc-2', 'pc-3']).toContain((action as { target: string }).target);
    for (const c of party(b)) if (c !== snag) c.status = 'dead';
    expect(monsterAction(b, snag)).toEqual({ kind: 'wait' });
  });

  it('are left be by their charmer’s side while anyone else can be struck', () => {
    const b = standardBattle([['vampire']]);
    const [snag, grukk] = party(b) as [Combatant, Combatant];
    charmBy(b, snag);
    const sword = vampire(b).attacks[0] as Combatant['attacks'][number];
    expect(targets(b, vampire(b), sword)).toEqual([grukk]);
    for (const c of party(b)) if (c !== snag) c.status = 'dead';
    expect(targets(b, vampire(b), sword)).toEqual([snag]);
  });

  it('never wait on the player, and count for neither side’s fighters', () => {
    const b = standardBattle([['vampire']]);
    for (const c of party(b)) charmBy(b, c);
    expect(fighters(b, 'party')).toEqual([]);
    // With every PC charmed the party has lost, and the charms end with the fight.
    expect(advance(b, (c) => c.kind === 'pc')).toBeNull();
    expect(b.outcome).toBe('enemy');
    expect(party(b).every((c) => c.charm === null)).toBe(true);
  });

  it('throw the charm off with a save at the end of the round, or when the charmer falls', () => {
    const b = standardBattle([['vampire']]);
    const [snag, grukk] = party(b) as [Combatant, Combatant];
    charmBy(b, snag);
    charmBy(b, grukk);
    b.rng = scriptedRng([20, 1]);
    throwOffCharms(b);
    expect([snag.charm, grukk.charm !== null]).toEqual([null, true]);
    expect(b.log?.join(' ')).toContain("Snag shakes off Vampire's charm.");
    vampire(b).status = 'dead';
    throwOffCharms(b);
    expect(grukk.charm).toBeNull();
    // The fallen charmed are simply free.
    charmBy(b, snag);
    snag.status = 'dead';
    throwOffCharms(b);
    expect(snag.charm).toBeNull();
    charmBy(b, grukk);
    endCharms(b);
    expect(grukk.charm).toBeNull();
  });

  it('end the round as the round runs', () => {
    const b = standardBattle([['vampire']]);
    const snag = who(b, 'Snag');
    charmBy(b, snag);
    vampire(b).status = 'dead';
    endOfRound(b);
    expect(snag.charm).toBeNull();
  });
});

describe('the rising dead', () => {
  it('raise the party’s dead who carried Grave Rot in the foes’ front row, once', () => {
    const b = standardBattle([['gnawing-dead'], ['thug-or-militia']]);
    const [snag, grukk, lirael] = party(b) as [Combatant, Combatant, Combatant];
    snag.status = 'dead';
    snag.caught = 'grave-rot';
    grukk.status = 'dead';
    grukk.carries = 'grave-rot';
    lirael.status = 'dead';
    lirael.carries = 'swamp-fever';
    raiseTheDead(b);
    const risen = b.combatants.filter((c) => c.id.startsWith('risen-'));
    expect(risen.map((c) => [c.name, c.side, c.row, c.column, c.group])).toEqual([
      ['Gnawing Dead (Snag)', 'enemy', 0, 1, 2],
      ['Gnawing Dead (Grukk)', 'enemy', 0, 2, 3],
    ]);
    expect(b.log?.join(' ')).toContain("Snag's corpse rises as a gnawing dead.");
    raiseTheDead(b);
    expect(b.combatants.filter((c) => c.id.startsWith('risen-'))).toHaveLength(2);
  });

  it('leave the unliving and those facing a formation where they lie', () => {
    const b = standardBattle([['gnawing-dead']]);
    const snag = who(b, 'Snag');
    Object.assign(snag, { status: 'dead', caught: 'grave-rot', tags: new Set(['unliving']) });
    raiseTheDead(b);
    expect(b.combatants).toHaveLength(5);
    const rivals = createBattle({
      data,
      rng: createRng('rivals'),
      party: [{ character: starter('snag') }],
      enemies: [],
      rivals: [{ character: starter('grukk'), row: 0, column: 0 }],
    });
    Object.assign(rivals.combatants[0] as Combatant, { status: 'dead', carries: 'grave-rot' });
    raiseTheDead(rivals);
    expect(rivals.combatants).toHaveLength(2);
  });
});
