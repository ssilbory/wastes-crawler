import { describe, expect, it } from 'vitest';
import { setDefaultAction } from '../../../src/game/world/members.ts';
import { world } from './helpers.ts';

describe('setDefaultAction', () => {
  it("sets the chosen member's default and leaves the rest alone", () => {
    const w = world();
    const [first, second] = w.members;
    if (!first || !second) throw new Error('party expected');
    setDefaultAction(w, first.id, 'defend');
    expect(first.defaultAction).toBe('defend');
    expect(second.defaultAction).toBe('auto');
  });

  it('ignores an id no member carries', () => {
    const w = world();
    const before = w.members.map((m) => m.defaultAction);
    setDefaultAction(w, 'nobody', 'defend');
    expect(w.members.map((m) => m.defaultAction)).toEqual(before);
  });
});
