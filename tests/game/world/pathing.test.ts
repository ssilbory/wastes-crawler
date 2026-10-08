import { describe, expect, it } from 'vitest';
import { findPath, pathToward, regionMap } from '../../../src/game/world/region.ts';
import { hexKey, type Hex } from '../../../src/rules/hex.ts';
import { data } from './helpers.ts';

const map = regionMap(data, 'borderlands');
const keys = (path: Hex[] | null) => path?.map(hexKey) ?? null;
const known = (...list: string[]) => new Set(list);

describe('heading toward a hex', () => {
  it('takes the full route once the hex is known', () => {
    const line = known('3,8', '4,8', '5,8', '6,8');
    const from = { col: 3, row: 8 };
    const to = { col: 6, row: 8 };
    expect(pathToward(map, from, to, line)).toEqual(findPath(map, from, to, line));
    expect(keys(pathToward(map, from, to, line))).toEqual(['4,8', '5,8', '6,8']);
  });

  it('stops at the known hex nearest an unexplored one, never stepping into fog', () => {
    const line = known('3,8', '4,8', '5,8', '6,8');
    expect(keys(pathToward(map, { col: 3, row: 8 }, { col: 10, row: 8 }, line))).toEqual([
      '4,8',
      '5,8',
      '6,8',
    ]);
  });

  it('takes the cheaper route when known hexes tie for nearest', () => {
    // Every hex in column 6 from row 1 to 15 is 14 hexes from 20,8.
    const land = known('5,8', '6,8', '5,9', '5,10', '6,10');
    expect(keys(pathToward(map, { col: 5, row: 8 }, { col: 20, row: 8 }, land))).toEqual(['6,8']);
  });

  it('goes around avoided hexes', () => {
    const line = known('3,8', '4,8', '5,8', '6,8');
    const from = { col: 3, row: 8 };
    expect(keys(pathToward(map, from, { col: 10, row: 8 }, line, known('5,8')))).toEqual(['4,8']);
  });

  it('is null when no known hex is nearer, or the known hex cannot be reached', () => {
    const line = known('3,8', '4,8', '5,8', '6,8');
    expect(pathToward(map, { col: 6, row: 8 }, { col: 10, row: 8 }, line)).toBeNull();
    // The lake at 6,4 is known, so findPath's answer stands.
    expect(pathToward(map, { col: 6, row: 7 }, { col: 6, row: 4 }, known('6,7', '6,4'))).toBeNull();
  });
});
