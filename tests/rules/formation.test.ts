import { describe, expect, it } from 'vitest';
import { servantPlace, type Occupant } from '../../src/rules/formation.ts';

const at = (row: number, column: number, hp = 10, yields = true): Occupant => ({
  row,
  column,
  hp,
  yields,
});

describe('servant placement', () => {
  it('takes the first free front slot, moving no one', () => {
    expect(servantPlace([])).toEqual({ row: 0, column: 0, bump: null });
    expect(servantPlace([at(0, 0), at(0, 1), at(0, 3), at(1, 2)])).toEqual({
      row: 0,
      column: 2,
      bump: null,
    });
  });

  it('with the front full, the yielding ally with the fewest HP steps back behind them', () => {
    const front = [at(0, 0, 9), at(0, 1, 4), at(0, 2, 7), at(0, 3, 12)];
    expect(servantPlace(front)).toEqual({ row: 0, column: 1, bump: { index: 1, column: 1 } });
  });

  it('sends the one stepping back to the first free rear slot when theirs is taken', () => {
    const lineup = [at(0, 0, 9), at(0, 1, 4), at(0, 2, 7), at(0, 3, 12), at(1, 0), at(1, 1)];
    expect(servantPlace(lineup)).toEqual({ row: 0, column: 1, bump: { index: 1, column: 2 } });
  });

  it('breaks an HP tie by the leftmost', () => {
    const front = [at(0, 2, 5), at(0, 0, 8), at(0, 3, 5), at(0, 1, 6)];
    expect(servantPlace(front)?.bump).toEqual({ index: 0, column: 2 });
  });

  it('never moves one who doesn’t yield, however hurt', () => {
    const front = [at(0, 0, 1, false), at(0, 1, 9), at(0, 2, 3, false), at(0, 3, 6)];
    expect(servantPlace(front)).toEqual({ row: 0, column: 3, bump: { index: 3, column: 3 } });
  });

  it('takes a rear slot when no one in front yields', () => {
    const front = [0, 1, 2, 3].map((c) => at(0, c, 5, false));
    expect(servantPlace([...front, at(1, 0)])).toEqual({ row: 1, column: 1, bump: null });
  });

  it('finds no place with the front full and no rear slot free', () => {
    const full = [0, 1].flatMap((row) => [0, 1, 2, 3].map((c) => at(row, c)));
    expect(servantPlace(full)).toBeNull();
  });
});
