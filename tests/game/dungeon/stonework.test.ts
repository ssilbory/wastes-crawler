import { describe, expect, it } from 'vitest';
import {
  dissolve,
  gateBar,
  gateTargets,
  LITHIC,
  PALLID_GATE,
  pierceGate,
} from '../../../src/game/dungeon/stonework.ts';
import { fail, highMage } from '../world/helpers-mage.ts';
import { data, encounter, world } from '../world/helpers.ts';
import { below, place, state } from './helpers.ts';

describe('The Decree of Lithic Dissolution', () => {
  it('turns every wall ahead to dust, a cell deep per caster level', () => {
    const w = place(below(), 'barrow-upper', 3, 1, 'e');
    const m = highMage(w, [LITHIC], 3);
    const turn = state(w).turn;
    expect(dissolve(w, data, m.id)).toEqual({ ok: true });
    // The secret door at 3,1 and the wall past the open cell at 4,1.
    expect(state(w).dug['barrow-upper']).toEqual(['4,1,w', '6,1,w']);
    expect(state(w).turn).toBe(turn + 1);
    expect(m.spellsCast).toBe(1);
    expect(w.log.join('\n')).toContain('Fizzwick speaks the decree');
  });

  it('reaches only as far as the caster level allows', () => {
    // Row 4 is a line of walled-off cells.
    const dug = (level: number) => {
      const w = place(below(), 'barrow-upper', 0, 4, 'e');
      dissolve(w, data, highMage(w, [LITHIC], level).id);
      return state(w).dug['barrow-upper'];
    };
    expect(dug(3)).toEqual(['1,4,w', '2,4,w', '3,4,w']);
    expect(dug(4)).toHaveLength(4);
    const w = place(below(), 'barrow-upper', 0, 4, 'e');
    // A level-2 spell needs a level-3 caster.
    expect(dissolve(w, data, highMage(w, [LITHIC], 2).id)).toEqual(
      fail("Fizzwick can't cast level-2 spells yet."),
    );
  });

  it('stops at the level edge, and needs a wall ahead', () => {
    const w = place(below(), 'barrow-upper', 0, 1, 'w');
    const m = highMage(w, [LITHIC], 5);
    expect(dissolve(w, data, m.id)).toEqual(fail('Only solid rock lies beyond.'));
    place(w, 'barrow-upper', 0, 1, 'e');
    expect(dissolve(w, data, m.id)).toEqual(fail('There is no wall ahead to dissolve.'));
    // Long enough to reach the outer wall: it stops there.
    const v = place(below(), 'barrow-upper', 5, 1, 'e');
    const n = highMage(v, [LITHIC], 10);
    expect(dissolve(v, data, n.id)).toEqual({ ok: true });
    expect(state(v).dug['barrow-upper']).toEqual(['6,1,w']);
    v.encounter = encounter([['thug-or-militia']]);
    expect(dissolve(v, data, n.id)).toEqual(fail('Settle the encounter first.'));
    expect(() => dissolve(world(), data, n.id)).toThrow('the party is not in a dungeon');
  });
});

describe('Pierce the Pallid Gate', () => {
  it('measures a rift: at least 20 feet, at most 100 feet a caster level', () => {
    expect(gateBar({ x: 0, y: 0 }, { x: 1, y: 1 }, 7)).toBe('too near');
    expect(gateBar({ x: 0, y: 0 }, { x: 2, y: 0 }, 7)).toBeNull();
    expect(gateBar({ x: 0, y: 0 }, { x: 70, y: 0 }, 7)).toBeNull();
    expect(gateBar({ x: 0, y: 0 }, { x: 70, y: 1 }, 7)).toBe('too far');
  });

  it('opens on seen stairs and safe squares, not where the party stands', () => {
    const w = place(below(), 'barrow-upper', 4, 0, 's');
    state(w).seen['barrow-upper'] = ['4,0', '5,0', '9,0', '1,8', '3,3'];
    expect(gateTargets(w, data)).toEqual([
      { x: 1, y: 8 },
      { x: 9, y: 0 },
      { x: 5, y: 0 },
    ]);
  });

  it('steps the party through to a cell it has seen', () => {
    const w = place(below(), 'barrow-upper', 4, 0, 's');
    const m = highMage(w, [PALLID_GATE], 7);
    state(w).seen['barrow-upper'] = ['4,0', '5,0', '9,0'];
    expect(pierceGate(w, data, m.id, { x: 5, y: 0 })).toEqual(fail('That is too near for a rift.'));
    expect(pierceGate(w, data, m.id, { x: 1, y: 8 })).toEqual(
      fail('The rift can open only on stairs or a safe square the party has seen.'),
    );
    expect(m.spellsCast).toBe(0);
    expect(pierceGate(w, data, m.id, { x: 9, y: 0 })).toEqual({ ok: true });
    expect(state(w).at).toEqual({ x: 9, y: 0 });
    expect(state(w).facing).toBe('s');
    expect(m.spellsCast).toBe(1);
    expect(w.log.join('\n')).toContain('Fizzwick tears open a pale rift');
    w.encounter = encounter([['thug-or-militia']]);
    expect(pierceGate(w, data, m.id, { x: 4, y: 0 })).toEqual(fail('Settle the encounter first.'));
  });
});
