import { describe, expect, it } from 'vitest';
import { act, createBattle, type MountSetup } from '../../../src/game/combat/battle.ts';
import { resolveAttack } from '../../../src/game/combat/attack.ts';
import { commandsFor } from '../../../src/game/combat/commands.ts';
import { endOfRound } from '../../../src/game/combat/round.ts';
import type { Attack, Battle } from '../../../src/game/combat/types.ts';
import { createRng } from '../../../src/rules/rng.ts';
import { scriptedRng } from '../../helpers/scripted-rng.ts';
import { data, starter, who } from './helpers.ts';

const boar = (over: Partial<MountSetup> = {}): MountSetup => ({
  monster: 'war-boar',
  name: 'Tusker',
  rider: 1,
  hp: 20,
  maxHp: 20,
  ...over,
});

/** Snag and Grukk in front, Lirael behind Snag; Grukk rides a war boar. */
function mounted(over: Partial<MountSetup> = {}): Battle {
  return createBattle({
    data,
    rng: createRng('mounts'),
    party: [
      { character: starter('snag'), row: 0, column: 0 },
      { character: starter('grukk'), row: 0, column: 1 },
      { character: starter('lirael'), row: 1, column: 0 },
    ],
    mounts: [boar(over)],
    enemies: [['thug-or-militia']],
    log: true,
  });
}

describe('war mounts in battle (docs/rules-adaptation.md, Mounts)', () => {
  it("fights from its rider's slot with its own stat line", () => {
    const b = mounted();
    const tusker = who(b, 'mount-0');
    expect(tusker).toMatchObject({
      name: 'Tusker',
      side: 'party',
      kind: 'monster',
      row: 0,
      column: 1,
      hp: 20,
      ac: 13,
      rider: 'pc-1',
      steedGuard: false,
    });
    expect(tusker.attacks[0]?.damage).toEqual({ count: 1, sides: 10, modifier: 0 });
    // Rider: the rider's AC when it is higher, never lower.
    expect(who(mounted({ ac: 18 }), 'mount-0').ac).toBe(18);
    expect(who(mounted({ ac: 10 }), 'mount-0').ac).toBe(13);
    expect(who(mounted({ hp: 0 }), 'mount-0').status).toBe('dead');
  });

  it('takes no slot: others can still move to every empty slot', () => {
    const b = mounted();
    const lirael = who(b, 'Lirael');
    const moves = commandsFor(b, lirael).find((c) => c.group === 'move');
    const labels = (moves?.choices ?? []).map((c) => c.label);
    expect(labels).not.toContain('Front row, slot 2');
    expect(labels).toContain('Rear row, slot 2');
  });

  it('moves with its rider, by command or by the front drop', () => {
    const b = mounted();
    const grukk = who(b, 'Grukk');
    const tusker = who(b, 'mount-0');
    act(b, grukk, { kind: 'move', row: 1, column: 3 });
    expect([tusker.row, tusker.column]).toEqual([1, 3]);
    act(b, grukk, { kind: 'move', row: 0, column: 1 });
    // A fallen rider drops back, and the mount goes with them.
    grukk.status = 'dying';
    endOfRound(b);
    expect([grukk.row, grukk.column]).toEqual([1, 1]);
    expect([tusker.row, tusker.column]).toEqual([1, 1]);
  });

  it('lets a Rider turn aside, once, a blow that would drop the mount', () => {
    const b = mounted({ guard: true });
    const thug = who(b, 'foe-0-0');
    const tusker = who(b, 'mount-0');
    tusker.hp = 3;
    b.rng = scriptedRng([19, 6]);
    resolveAttack(b, thug, thug.attacks[0] as Attack, tusker);
    expect(tusker).toMatchObject({ hp: 3, steedGuard: false });
    expect(b.log?.at(-1)).toContain('Grukk turns Tusker aside');
    expect(b.events?.at(-1)).toEqual({
      kind: 'turned',
      actor: thug.id,
      target: tusker.id,
      amount: 0,
    });
    b.rng = scriptedRng([19, 6]);
    resolveAttack(b, thug, thug.attacks[0] as Attack, tusker);
    expect(tusker.status).toBe('dead');
  });

  it("can't guard the mount while the rider is down, or from a lesser blow", () => {
    const b = mounted({ guard: true });
    const thug = who(b, 'foe-0-0');
    const tusker = who(b, 'mount-0');
    tusker.hp = 10;
    b.rng = scriptedRng([19, 2]);
    resolveAttack(b, thug, thug.attacks[0] as Attack, tusker);
    expect(tusker).toMatchObject({ hp: 8, steedGuard: true });
    tusker.hp = 2;
    who(b, 'Grukk').status = 'dying';
    b.rng = scriptedRng([19, 6]);
    resolveAttack(b, thug, thug.attacks[0] as Attack, tusker);
    expect(tusker.status).toBe('dead');
  });
});
