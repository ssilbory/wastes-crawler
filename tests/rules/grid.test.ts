import { describe, expect, it } from 'vitest';
import { ahead, beside, cellKey, turn } from '../../src/rules/grid.ts';

describe('dungeon grid geometry', () => {
  it('turns a quarter or half a turn', () => {
    expect(turn('n', 'left')).toBe('w');
    expect(turn('n', 'right')).toBe('e');
    expect(turn('w', 'right')).toBe('n');
    expect(turn('e', 'around')).toBe('w');
  });

  it('steps ahead, behind, and aside, with y growing south', () => {
    expect(ahead({ x: 2, y: 2 }, 'n')).toEqual({ x: 2, y: 1 });
    expect(ahead({ x: 2, y: 2 }, 'e', 3)).toEqual({ x: 5, y: 2 });
    expect(ahead({ x: 2, y: 2 }, 's', -1)).toEqual({ x: 2, y: 1 });
    expect(beside({ x: 2, y: 2 }, 'n', 'left')).toEqual({ x: 1, y: 2 });
    expect(beside({ x: 2, y: 2 }, 'w', 'right')).toEqual({ x: 2, y: 1 });
    expect(cellKey({ x: 3, y: 4 })).toBe('3,4');
  });
});
