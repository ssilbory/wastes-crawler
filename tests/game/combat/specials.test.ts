import { describe, expect, it } from 'vitest';
import { act } from '../../../src/game/combat/actions.ts';
import { monsterAction } from '../../../src/game/combat/ai.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { monsterCombatant } from '../../../src/game/combat/monster-combatant.ts';
import { beginRound, runRound, takeTurn } from '../../../src/game/combat/round.ts';
import { afterHit, breathe, breathRow, resisted } from '../../../src/game/combat/specials.ts';
import { canAct } from '../../../src/game/combat/targeting.ts';
import type { Attack, Combatant } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, standardBattle, who } from './helpers.ts';

const at = (c: Combatant, i: number) => c.attacks[i] as Attack;

describe('creature routines (Phase 14a)', () => {
  it('builds mixed attacks from the routine, swinging each strike its count', () => {
    const bear = monsterCombatant(data, 'cave-bear', 'b', createRng('bear'));
    expect(bear.attacks.map((a) => [a.name, a.damage.sides, a.hit, a.shock?.damage])).toEqual([
      ['Claw', 8, 8, 3],
      ['Bite', 6, 8, 3],
    ]);
    expect(bear.routine).toEqual([0, 0, 1]);
    expect(bear.volley).toBeNull();
    const manticore = monsterCombatant(data, 'manticore', 'm', createRng('m'));
    expect(manticore.routine).toEqual([0, 0, 1]);
    expect(manticore.volley).toEqual([2, 2, 2]);
    expect(at(manticore, 2)).toMatchObject({ name: 'Tail spike', mode: 'ranged', shock: null });
    const ant = monsterCombatant(data, 'giant-ant', 'a', createRng('a'));
    expect(ant.routine).toBeNull();
    expect(ant.attacks).toHaveLength(1);
  });

  it('opens with a volley, then closes with the routine', () => {
    const b = standardBattle([['manticore']], createRng('volley'));
    const m = who(b, 'foe-0-0');
    m.hp = 999;
    const swings: (number | null)[] = [];
    const watch = (bb: typeof b, actor: Combatant) => {
      swings.push(actor.forcedAttack);
      return monsterAction(bb, actor);
    };
    b.queue = [m.id];
    takeTurn(b, m, watch);
    b.round = 2;
    b.queue = [m.id];
    takeTurn(b, m, watch);
    expect(swings).toEqual([2, 2, 2, 0, 0, 1]);
  });

  it('falls back to the volley when the routine reaches no one', () => {
    const b = standardBattle([['thug-or-militia'], ['manticore']], createRng('reach'));
    const m = who(b, 'foe-1-0');
    m.tags.delete('flying');
    b.round = 2;
    b.queue = [m.id];
    const swings: (number | null)[] = [];
    takeTurn(b, m, (bb, actor) => {
      swings.push(actor.forcedAttack);
      return monsterAction(bb, actor);
    });
    expect(swings).toEqual([2, 2, 2]);
  });
});

describe('breath weapons', () => {
  it('sweep the fullest row, each victim saving for half, until used up', () => {
    const b = standardBattle([['grave-wyrm']]);
    const wyrm = who(b, 'foe-0-0');
    expect(breathRow(b, wyrm)).toBe(0);
    expect(monsterAction(b, wyrm)).toEqual({ kind: 'breath', row: 0 });
    const [snag, grukk] = [who(b, 'Snag'), who(b, 'Grukk')];
    for (const pc of [snag, grukk]) pc.hp = 100;
    // 4d8 = 20; Snag saves (20 against his Evasion), Grukk fails (2).
    b.rng = scriptedRng([5, 5, 5, 5, 20, 2]);
    act(b, wyrm, { kind: 'breath', row: 0 });
    expect([snag.hp, grukk.hp]).toEqual([90, 80]);
    expect(wyrm.breathLeft).toBe(1);
    wyrm.breathLeft = 0;
    breathe(b, wyrm, 0);
    expect(snag.hp).toBe(90);
    // An instinctive wyrm forgets its breath.
    wyrm.breathLeft = 1;
    wyrm.instinctive = true;
    b.rng = createRng('instinct');
    expect(monsterAction(b, wyrm).kind).toBe('attack');
    for (const c of b.combatants) if (c.side === 'party') c.status = 'dead';
    expect(breathRow(b, wyrm)).toBeNull();
    breathe(monsterCombatantBattle(), monsterCombatant(data, 'cave-bear', 'x', createRng('x')), 0);
  });
});

function monsterCombatantBattle() {
  return standardBattle([['zombie']]);
}

describe('resistances and slowness', () => {
  it('halves blunt blows and edged ones as listed, and takes 1 from missiles', () => {
    const z = monsterCombatant(data, 'zombie', 'z', createRng('z'));
    const blow = (a: Partial<Attack>): Attack => ({ ...at(z, 0), blunt: false, ...a });
    expect(resisted(z, blow({ blunt: true }), 7)).toBe(3);
    expect(resisted(z, blow({ blunt: true }), 1)).toBe(1);
    expect(resisted(z, blow({}), 7)).toBe(7);
    expect(resisted(z, blow({ mode: 'ranged' }), 7)).toBe(1);
    expect(resisted(z, blow({ mode: 'thrown' }), 7)).toBe(1);
    expect(resisted(z, blow({ blunt: true }), 0)).toBe(0);
    z.resist = { edged: 'half' };
    expect(resisted(z, blow({}), 7)).toBe(3);
    expect(resisted(z, blow({ blunt: true }), 7)).toBe(7);
    expect(resisted(z, blow({ mode: 'ranged' }), 7)).toBe(7);
    const bear = monsterCombatant(data, 'cave-bear', 'b', createRng('b'));
    expect(resisted(bear, blow({}), 7)).toBe(7);
  });

  it('reduce Shock too', () => {
    const b = standardBattle([['zombie']]);
    const z = who(b, 'foe-0-0');
    z.hp = 50;
    z.ac = 10;
    const club: Attack = { ...at(who(b, 'Snag'), 0), blunt: true, shock: { damage: 4, maxAc: 15 } };
    // A miss (1) with 4 Shock, halved to 2.
    b.rng = scriptedRng([1]);
    resolveAttack(b, who(b, 'Snag'), club, z);
    expect(z.hp).toBe(48);
  });

  it('act last whatever the initiative', () => {
    const b = standardBattle([['zombie', 'thug-or-militia']]);
    b.partyFirst = false;
    beginRound(b);
    expect(b.queue.at(-1)).toBe('foe-0-0');
    expect(b.queue[0]).toBe('foe-0-1');
  });
});

describe('on-hit effects', () => {
  it('poison: a Physical save at a penalty, or half maximum hit points', () => {
    const b = standardBattle([['giant-black-widow']]);
    const spider = who(b, 'foe-0-0');
    const bite = at(spider, 0);
    const grukk = who(b, 'Grukk');
    grukk.hp = grukk.maxHp;
    // 2 at -2 fails any save.
    b.rng = scriptedRng([2]);
    afterHit(b, bite, grukk);
    expect(grukk.hp).toBe(grukk.maxHp - Math.floor(grukk.maxHp / 2));
    grukk.hp = grukk.maxHp;
    b.rng = scriptedRng([20]);
    afterHit(b, bite, grukk);
    expect(grukk.hp).toBe(grukk.maxHp);
    grukk.status = 'dying';
    afterHit(b, bite, grukk);
    afterHit(b, at(who(b, 'Snag'), 0), who(b, 'Snag'));
  });

  it('paralysis: a Physical save or held, unable to act, for the rolled rounds', () => {
    const b = standardBattle([['grave-wyrm', 'zombie']]);
    const claw = at(who(b, 'foe-0-0'), 0);
    const snag = who(b, 'Snag');
    b.rng = scriptedRng([20]);
    afterHit(b, claw, snag);
    expect(snag.heldRounds).toBe(0);
    b.rng = scriptedRng([2, 3]);
    afterHit(b, claw, snag);
    expect(snag.heldRounds).toBe(3);
    expect(canAct(snag)).toBe(false);
    // The dead can't be paralyzed.
    afterHit(b, claw, who(b, 'foe-0-1'));
    expect(who(b, 'foe-0-1').heldRounds).toBe(0);
    // Held rounds wear off at the end of each round.
    who(b, 'foe-0-1').status = 'active';
    b.rng = createRng('rounds');
    const wait = () => ({ kind: 'wait' as const });
    runRound(b, wait, wait);
    expect(snag.heldRounds).toBe(2);
  });
});
