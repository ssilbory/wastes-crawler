import { describe, expect, it } from 'vitest';
import { followRiders, inSlot } from '../../../src/game/combat/mounted.ts';
import type { Combatant } from '../../../src/game/combat/types.ts';

const at = (id: string, row: number, column: number, rider: string | null = null) =>
  ({ id, row, column, rider }) as Combatant;

describe('war mounts in formation (docs/rules-adaptation.md, Mounts)', () => {
  it('holds no slot of its own while ridden', () => {
    expect(inSlot(at('pc-0', 0, 0))).toBe(true);
    expect(inSlot(at('mount-0', 0, 0, 'pc-0'))).toBe(false);
  });

  it('moves each mount under its rider, and leaves one whose rider is gone where it stands', () => {
    const rider = at('pc-0', 1, 2);
    const ridden = at('mount-0', 0, 0, 'pc-0');
    const stray = at('mount-1', 0, 1, 'pc-9');
    followRiders([rider, ridden, stray]);
    expect([ridden.row, ridden.column]).toEqual([1, 2]);
    expect([stray.row, stray.column]).toEqual([0, 1]);
  });
});
